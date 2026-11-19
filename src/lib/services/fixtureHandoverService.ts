import { db } from '@/lib/firebase';
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
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import {
  FixtureHandoverDocument,
  FixtureHandoverStatus,
  FixtureItem,
  FixtureRoomType,
  FixtureTemplate,
  DEFAULT_FIXTURE_ITEMS
} from '@/lib/types/fixtureHandover';
import { CURRENT_SCHOOL_YEAR } from '@/lib/services/handoverService';
import { getOrgStructure } from '@/lib/services/settingsService';
import type { OrgStructure } from '@/lib/types';
import { getTeacherStampSignature, isActualSignature } from '@/lib/safety/stampHelper';
import { getTeacherSignaturesDirectory } from '@/lib/services/userService';

export const FIXTURE_COLLECTION = 'handover_documents';
export const FIXTURE_TEMPLATE_PREFIX = 'fixture_tpl_';

/**
 * 학급/특별실 scopeKey 생성
 * 학급: classroom_3_1
 * 특별실: special_제1과학실
 */
export function getFixtureScopeKey(
  type: FixtureRoomType,
  grade?: string,
  classNum?: string,
  roomName?: string
): string {
  if (type === 'CLASSROOM') {
    const g = (grade || '').replace(/[^0-9]/g, '') || '0';
    const c = (classNum || '').replace(/[^0-9]/g, '') || '0';
    return `classroom_${g}_${c}`;
  }
  const cleanName = (roomName || '').trim().replace(/[\/\s]+/g, '_') || 'unnamed';
  return `special_${cleanName}`;
}

/**
 * 해당 학급/특별실에 저장된 지속 템플릿(비품 목록 및 윈도우 비번) 조회
 * settings 컬렉션의 fixture_tpl_{scopeKey} 문서 활용 (원격 보안규칙 완전 호환)
 */
export async function getFixtureTemplate(scopeKey: string): Promise<FixtureTemplate | null> {
  if (!scopeKey) return null;
  try {
    const docRef = doc(db, 'settings', `${FIXTURE_TEMPLATE_PREFIX}${scopeKey}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as FixtureTemplate;
    }
    return null;
  } catch (err) {
    console.error('[fixtureHandoverService] getFixtureTemplate error:', err);
    return null;
  }
}

function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): T {
  const clean: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * 해당 학급/특별실의 비품 템플릿 저장 (다음 작성자에게 그대로 전달)
 */
export async function saveFixtureTemplate(
  template: Partial<FixtureTemplate> & {
    scopeKey: string;
    items: FixtureItem[];
    scopeType: FixtureRoomType;
    updatedBy: string;
  }
): Promise<void> {
  try {
    const docRef = doc(db, 'settings', `${FIXTURE_TEMPLATE_PREFIX}${template.scopeKey}`);
    const payload = sanitizeFirestorePayload({
      id: template.scopeKey,
      scopeKey: template.scopeKey,
      scopeType: template.scopeType,
      grade: template.grade || '',
      classNum: template.classNum || '',
      roomName: template.roomName || '',
      items: template.items,
      windowsPassword: template.windowsPassword || '없음',
      updatedAt: new Date().toISOString(),
      updatedBy: template.updatedBy,
      updatedByName: template.updatedByName || ''
    });
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.error('[fixtureHandoverService] saveFixtureTemplate error:', err);
  }
}

/**
 * 초기 비품 아이템 목록 생성 (템플릿 우선, 없으면 기본 13개)
 */
export function buildInitialFixtureItems(template?: FixtureTemplate | null): FixtureItem[] {
  if (template?.items && template.items.length > 0) {
    return template.items.map((item, idx) => ({
      id: item.id || `item_${idx + 1}_${Date.now()}`,
      itemNo: idx + 1,
      name: item.name,
      quantity: item.quantity,
      note: item.note || ''
    }));
  }
  return DEFAULT_FIXTURE_ITEMS.map((item, idx) => ({
    id: `item_${idx + 1}_${Date.now()}`,
    itemNo: item.itemNo,
    name: item.name,
    quantity: item.quantity,
    note: item.note
  }));
}

/**
 * 비품 인수인계 문서 목록 조회
 */
export async function getFixtureDocuments(
  year: number = CURRENT_SCHOOL_YEAR,
  options?: {
    authorEmail?: string;
    successorEmail?: string;
    type?: FixtureRoomType;
    status?: FixtureHandoverStatus;
  }
): Promise<FixtureHandoverDocument[]> {
  try {
    console.log('[fixtureService.getFixtureDocuments] start, collection:', FIXTURE_COLLECTION);
    const colRef = collection(db, FIXTURE_COLLECTION);
    const q = query(colRef, where('isFixture', '==', true));
    const snap = await getDocs(q);
    console.log('[fixtureService.getFixtureDocuments] snap size:', snap.size);
    let list: FixtureHandoverDocument[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as FixtureHandoverDocument;
      if (!year || data.year === year) {
        // 기존 문서 중 과거 하드코딩 '정영찬'이 저장된 경우, 실시간 학교 리더십 교감 성명('신선영')으로 정제 및 자가 치유
        if (!data.vicePrincipalName || data.vicePrincipalName.trim() === '정영찬') {
          data.vicePrincipalName = '신선영';
          data.vicePrincipalEmail = data.vicePrincipalEmail || 'shinedu@kshcm.net';
          updateDoc(docSnap.ref, {
            vicePrincipalName: '신선영',
            vicePrincipalEmail: data.vicePrincipalEmail || 'shinedu@kshcm.net'
          }).catch(() => {});
        }
        list.push(data);
      }
    });

    if (options?.authorEmail) {
      const emailLower = options.authorEmail.trim().toLowerCase();
      list = list.filter((d) => d.authorEmail?.trim().toLowerCase() === emailLower);
    }
    if (options?.successorEmail) {
      const succLower = options.successorEmail.trim().toLowerCase();
      list = list.filter((d) => d.successorEmail?.trim().toLowerCase() === succLower);
    }
    if (options?.type) {
      list = list.filter((d) => d.type === options.type);
    }
    if (options?.status) {
      list = list.filter((d) => d.status === options.status);
    }

    // 정렬: 학년-반 순서, 그 후 특별실명 가나다순
    list.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'CLASSROOM' ? -1 : 1;
      if (a.type === 'CLASSROOM') {
        const ag = parseInt(a.grade || '0', 10);
        const bg = parseInt(b.grade || '0', 10);
        if (ag !== bg) return ag - bg;
        const ac = parseInt(a.classNum || '0', 10);
        const bc = parseInt(b.classNum || '0', 10);
        return ac - bc;
      }
      return (a.roomName || '').localeCompare(b.roomName || '');
    });

    return list;
  } catch (err) {
    console.error('[fixtureHandoverService] getFixtureDocuments error:', err);
    return [];
  }
}

/**
 * 로그인한 차년도 인수자에게 전달되었으나 아직 확인·서명하지 않은 비품 인계서 목록 (팝업 알림용)
 */
export async function getUncheckedFixturesForSuccessor(
  successorEmail: string,
  year: number = CURRENT_SCHOOL_YEAR
): Promise<FixtureHandoverDocument[]> {
  const emailLower = (successorEmail || '').trim().toLowerCase();
  if (!emailLower) return [];
  const q = query(collection(db, FIXTURE_COLLECTION), where('successorEmail', '==', emailLower));
  const snap = await getDocs(q);
  const list: FixtureHandoverDocument[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as FixtureHandoverDocument & { isFixture?: boolean };
    if (!data.isFixture) return;
    if (year && data.year !== year) return;
    if (data.status !== 'SUBMITTED_WAITING_SUCCESSOR' || data.successorChecked) return;
    list.push({ ...data, id: docSnap.id });
  });
  return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * 단일 문서 조회
 */
export async function getFixtureDocumentById(id: string): Promise<FixtureHandoverDocument | null> {
  try {
    const docRef = doc(db, FIXTURE_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as FixtureHandoverDocument;
    }
    return null;
  } catch (err) {
    console.error('[fixtureHandoverService] getFixtureDocumentById error:', err);
    return null;
  }
}

/**
 * 시스템 설정(학교 리더십)에 등록된 현재 교감 정보 조회
 */
export async function getResolvedVicePrincipalInfo(): Promise<{ name: string; email: string; role: string }> {
  try {
    const org = await getOrgStructure();
    let vpName = org.vicePrincipalName?.trim() || '';
    const vpEmail = org.vicePrincipal?.trim() || 'shinedu@kshcm.net';

    if (!vpName && vpEmail) {
      const userQ = query(collection(db, 'users'), where('email', '==', vpEmail.toLowerCase()));
      const snap = await getDocs(userQ);
      if (!snap.empty) {
        const uData = snap.docs[0].data();
        vpName = uData?.name || '';
      }
    }

    return {
      name: vpName || '신선영',
      email: vpEmail,
      role: '교감'
    };
  } catch (e) {
    console.warn('[fixtureHandoverService] 교감 정보 조회 실패:', e);
    return {
      name: '신선영',
      email: 'shinedu@kshcm.net',
      role: '교감'
    };
  }
}

/**
 * 시스템 설정(학교 리더십) 또는 교원 계정으로부터 교감 성명 결정
 * 과거 임의 하드코딩값('정영찬')을 철저히 배제하고 학교 리더십에 등록된 실제 교감 성명을 반환
 */
export function resolveVicePrincipalNameFromOrg(org?: OrgStructure | null): string {
  if (org?.vicePrincipalName && org.vicePrincipalName.trim() && org.vicePrincipalName.trim() !== '정영찬') {
    return org.vicePrincipalName.trim();
  }
  if (org?.vicePrincipal && org.vicePrincipal.trim()) {
    const email = org.vicePrincipal.trim().toLowerCase();
    if (email.includes('shinedu')) return '신선영';
  }
  return '신선영';
}

/**
 * 문서와 학교 리더십을 종합하여 화면/인쇄에 표출할 최종 교감 성명 결정
 */
export function getDisplayVicePrincipalName(
  docData?: Partial<FixtureHandoverDocument> | null,
  org?: OrgStructure | null
): string {
  if (docData?.vicePrincipalName && docData.vicePrincipalName.trim() && docData.vicePrincipalName.trim() !== '정영찬') {
    return docData.vicePrincipalName.trim();
  }
  return resolveVicePrincipalNameFromOrg(org);
}

/**
 * 비품 인수인계 문서 저장 (임시저장 및 제출 공통)
 * 저장과 동시에 해당 학급/특별실의 지속 템플릿에 자동 반영!
 */
export async function saveFixtureDocument(
  docData: Partial<FixtureHandoverDocument> & {
    authorEmail: string;
    authorName: string;
    items: FixtureItem[];
    type: FixtureRoomType;
  }
): Promise<string> {
  const scopeKey = getFixtureScopeKey(docData.type, docData.grade, docData.classNum, docData.roomName);
  const year = docData.year || CURRENT_SCHOOL_YEAR;
  const docId = docData.id || `fixture_${year}_${scopeKey}`;

  let currentVpName = docData.vicePrincipalName?.trim() || '';
  let currentVpEmail = docData.vicePrincipalEmail?.trim() || '';
  if (!currentVpName || currentVpName === '정영찬') {
    const vpInfo = await getResolvedVicePrincipalInfo();
    currentVpName = vpInfo.name;
    if (!currentVpEmail) {
      currentVpEmail = vpInfo.email;
    }
  }

  // 인계자(제출자) 서명 보장 (실제 등록 서명 또는 직인 도장 Data URL)
  let resolvedAuthorSignature = docData.authorSignature || '';
  if (!isActualSignature(resolvedAuthorSignature)) {
    try {
      const sigMap = await getTeacherSignaturesDirectory();
      const authorEmailKey = (docData.authorEmail || '').trim().toLowerCase();
      const authorNameKey = (docData.authorName || '').trim();
      const registeredSig =
        (authorEmailKey && sigMap[authorEmailKey]) || (authorNameKey && sigMap[authorNameKey]) || null;
      if (isActualSignature(registeredSig)) {
        resolvedAuthorSignature = registeredSig!;
      } else {
        resolvedAuthorSignature = getTeacherStampSignature(authorNameKey || '교사');
      }
    } catch {
      resolvedAuthorSignature = getTeacherStampSignature(docData.authorName || '교사');
    }
  }

  const nowIso = new Date().toISOString();
  const payload: any = {
    id: docId,
    isFixture: true,
    year,
    targetNextYear: docData.targetNextYear || year + 1,
    type: docData.type,
    grade: docData.grade || '',
    classNum: docData.classNum || '',
    roomName: docData.roomName || '',
    nextYearGrade: docData.nextYearGrade || '',
    nextYearClassNum: docData.nextYearClassNum || '',
    nextYearRoomName: docData.nextYearRoomName || '',
    items: docData.items.map((it, idx) => ({
      ...it,
      itemNo: idx + 1
    })),
    windowsPassword: docData.windowsPassword || '없음',
    handoverDate: docData.handoverDate || nowIso.split('T')[0],
    authorEmail: docData.authorEmail,
    authorName: docData.authorName,
    authorRole: docData.authorRole || '교사',
    authorSignature: resolvedAuthorSignature,
    successorEmail: docData.successorEmail || '',
    successorName: docData.successorName || '',
    successorRole: docData.successorRole || '교사',
    successorSignature: docData.successorSignature || '',
    successorChecked: docData.successorChecked || false,
    successorCheckedAt: docData.successorCheckedAt || null,
    academicHeadEmail: docData.academicHeadEmail || '',
    academicHeadName: docData.academicHeadName || '',
    academicHeadChecked: docData.academicHeadChecked || false,
    academicHeadCheckedAt: docData.academicHeadCheckedAt || null,
    vicePrincipalEmail: currentVpEmail,
    vicePrincipalName: currentVpName,
    vicePrincipalRole: docData.vicePrincipalRole || '교감',
    vicePrincipalSignature: docData.vicePrincipalSignature || '',
    status: docData.status || 'DRAFT',
    submittedAt: docData.submittedAt || (docData.status && docData.status !== 'DRAFT' ? nowIso : null),
    approvedAt: docData.approvedAt || null,
    rejectionReason: docData.rejectionReason || '',
    createdAt: docData.createdAt || nowIso,
    updatedAt: nowIso
  };

  const docRef = doc(db, FIXTURE_COLLECTION, docId);
  await setDoc(docRef, sanitizeFirestorePayload(payload), { merge: true });

  // [수정 내용 향후 전달 규약] 지속 템플릿 자동 동기화
  await saveFixtureTemplate({
    scopeKey,
    scopeType: docData.type,
    grade: docData.grade || '',
    classNum: docData.classNum || '',
    roomName: docData.roomName || '',
    items: payload.items,
    windowsPassword: payload.windowsPassword,
    updatedBy: docData.authorEmail,
    updatedByName: docData.authorName
  });

  return docId;
}

/**
 * 인수인계 문서 상태의 한국어 표준 라벨
 */
export function getFixtureStatusLabel(status?: FixtureHandoverStatus | string | null): string {
  switch (status) {
    case 'DRAFT':
      return '작성 중';
    case 'SUBMITTED_WAITING_SUCCESSOR':
      return '인수자 확인 대기';
    case 'SUBMITTED_WAITING_ACADEMIC_HEAD':
    case 'SUBMITTED':
      return '교무부장 확인 대기';
    case 'READY_FOR_VP_APPROVAL':
      return '교감 결재 대기';
    case 'APPROVED':
      return '교감 확인 완료';
    case 'REJECTED':
      return '반려됨';
    default:
      return '작성 전';
  }
}

/**
 * 비품 인수인계 문서 제출 (후임자 지정 시 후임자에게 전달, 미정 시 교무부장에게 바로 모임)
 */
export async function submitFixtureDocument(id: string, successorEmail?: string): Promise<void> {
  const docRef = doc(db, FIXTURE_COLLECTION, id);
  const nowIso = new Date().toISOString();
  const nextStatus: FixtureHandoverStatus = successorEmail?.trim()
    ? 'SUBMITTED_WAITING_SUCCESSOR'
    : 'SUBMITTED_WAITING_ACADEMIC_HEAD';
  await updateDoc(docRef, {
    status: nextStatus,
    submittedAt: nowIso,
    updatedAt: nowIso
  });
}

/**
 * 비품 인수인계 문서 회수 (인계자가 제출 후 수정하기 위해 작성 중(DRAFT) 상태로 안전하게 복귀)
 */
export async function recallFixtureDocument(id: string): Promise<void> {
  const docRef = doc(db, FIXTURE_COLLECTION, id);
  const nowIso = new Date().toISOString();
  await updateDoc(docRef, {
    status: 'DRAFT',
    successorChecked: false,
    successorCheckedAt: null,
    successorSignature: '',
    academicHeadChecked: false,
    academicHeadCheckedAt: null,
    academicHeadName: '',
    updatedAt: nowIso
  });
}

/**
 * 후임 인수자 비품 수신 확인 완료 -> 교무부장 확인 대기로 전이
 */
export async function markFixtureSuccessorChecked(
  id: string,
  successorName: string = '',
  successorEmail: string = ''
): Promise<void> {
  const docRef = doc(db, FIXTURE_COLLECTION, id);
  const nowIso = new Date().toISOString();

  // 지정 인수자 본인만, 인수자 확인 대기 단계에서만 서명 가능 (중복 서명·단계 역행 방지)
  const currentSnap = await getDoc(docRef);
  if (!currentSnap.exists()) throw new Error('비품 인계서를 찾을 수 없습니다.');
  const currentDoc = currentSnap.data() as FixtureHandoverDocument;
  const targetEmail = (currentDoc.successorEmail || '').trim().toLowerCase();
  if (targetEmail && successorEmail && targetEmail !== successorEmail.trim().toLowerCase()) {
    throw new Error('이 비품 인계서의 지정 인수자만 확인·서명할 수 있습니다.');
  }
  if (currentDoc.successorChecked || currentDoc.status !== 'SUBMITTED_WAITING_SUCCESSOR') {
    throw new Error('이미 인수 확인이 완료되었거나 인수자 확인 단계가 아닌 비품 인계서입니다.');
  }

  // 후임 인수자 서명 보장 (실제 등록 서명 또는 직인 도장 Data URL)
  let successorSignature = '';
  try {
    const sigMap = await getTeacherSignaturesDirectory();
    const emailKey = successorEmail.trim().toLowerCase();
    const nameKey = successorName.trim();
    const registeredSig =
      (emailKey && sigMap[emailKey]) || (nameKey && sigMap[nameKey]) || null;
    if (isActualSignature(registeredSig)) {
      successorSignature = registeredSig!;
    } else {
      successorSignature = getTeacherStampSignature(nameKey || '교사');
    }
  } catch {
    successorSignature = getTeacherStampSignature(successorName || '교사');
  }

  await updateDoc(docRef, {
    successorChecked: true,
    successorCheckedAt: nowIso,
    successorSignature,
    status: 'SUBMITTED_WAITING_ACADEMIC_HEAD',
    updatedAt: nowIso
  });
}

/**
 * 교무부장 총괄 확인 완료 및 일괄 교감 최종 결재 상신
 */
export async function forwardFixtureHandoversToVicePrincipal(
  ids: string[],
  academicHeadName: string = '교무부장',
  academicHeadEmail: string = ''
): Promise<{ forwardedCount: number }> {
  const nowIso = new Date().toISOString();
  const vpInfo = await getResolvedVicePrincipalInfo();
  await Promise.all(
    ids.map(async (id) => {
      const docRef = doc(db, FIXTURE_COLLECTION, id);
      await updateDoc(docRef, {
        status: 'READY_FOR_VP_APPROVAL',
        academicHeadChecked: true,
        academicHeadCheckedAt: nowIso,
        academicHeadName,
        academicHeadEmail,
        vicePrincipalName: vpInfo.name,
        vicePrincipalEmail: vpInfo.email,
        updatedAt: nowIso
      });
    })
  );
  return { forwardedCount: ids.length };
}

/**
 * 결재 완료된 비품 인수인계서를 Google Drive 차년도 인수인계 폴더에 PDF로 아카이빙
 */
export async function archiveFixtureDocumentToDrive(
  docData: FixtureHandoverDocument,
  vpName?: string
): Promise<{ success: boolean; driveFileUrl?: string; error?: string }> {
  try {
    const { getGoogleDriveConfig } = await import('@/lib/services/settingsService');
    const driveConfig = await getGoogleDriveConfig().catch(() => null);
    if (!driveConfig?.enabled && !driveConfig?.rootFolderId) {
      return { success: false, error: 'Google Drive 연동이 활성화되지 않았습니다.' };
    }

    const htmlContent = generateFixtureHandoverA4Html(docData, vpName);
    const targetDutyName =
      docData.type === 'CLASSROOM'
        ? `${docData.grade}학년_${docData.classNum}반_비품인수인계`
        : `${docData.roomName || '특별실'}_비품인수인계`;

    const targetYearStr = String((docData.year || CURRENT_SCHOOL_YEAR) + 1);

    // 화면 [A4 인쇄]와 동일한 레이아웃의 PDF를 브라우저에서 렌더링 (실패 시 서버 Docs 변환으로 폴백)
    let pdfBase64: string | undefined;
    try {
      const { renderA4HtmlToPdfBase64 } = await import('@/lib/handover/a4HtmlPdfRenderer');
      pdfBase64 = await renderA4HtmlToPdfBase64(htmlContent);
    } catch (renderErr) {
      console.warn('[fixtureHandoverService] A4 PDF 렌더링 실패, 서버 변환으로 대체:', renderErr);
    }

    const res = await fetch('/api/drive/archive-handover', {
      method: 'POST',
      headers: await buildStaffApiHeaders(),
      body: JSON.stringify({
        docId: docData.id,
        docData: {
          year: docData.year,
          primaryDuty: targetDutyName,
          authorName: docData.authorName,
          submittedAt: docData.submittedAt || docData.updatedAt,
          vicePrincipalReviewedAt: docData.approvedAt || new Date().toISOString()
        },
        htmlContent,
        pdfBase64,
        targetYear: targetYearStr,
        rootFolderId: driveConfig?.rootFolderId,
        existingYearFolders: driveConfig?.yearlyFolders?.[targetYearStr] || null
      })
    });

    const resData = await res.json();
    if (res.ok && resData.success && resData.file?.webViewLink) {
      const docRef = doc(db, FIXTURE_COLLECTION, docData.id);
      await updateDoc(docRef, {
        archivedDriveFileId: resData.file.id,
        archivedDriveFileUrl: resData.file.webViewLink,
        archivedDriveFolderId: resData.file.folderId || '',
        updatedAt: new Date().toISOString()
      }).catch(() => {});
      return { success: true, driveFileUrl: resData.file.webViewLink };
    }
    return { success: false, error: resData.error || 'Drive 저장 실패' };
  } catch (err: any) {
    console.warn('[fixtureHandoverService] Drive 아카이빙 오류:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * 교감(입회자) 확인 완료
 */
export async function approveFixtureDocument(
  id: string,
  vpName?: string,
  vpEmail?: string
): Promise<void> {
  const docRef = doc(db, FIXTURE_COLLECTION, id);
  const nowIso = new Date().toISOString();
  let resolvedName = vpName?.trim();
  let resolvedEmail = vpEmail?.trim();
  if (!resolvedName || resolvedName === '정영찬') {
    const vpInfo = await getResolvedVicePrincipalInfo();
    resolvedName = vpInfo.name;
    resolvedEmail = resolvedEmail || vpInfo.email;
  }

  // 교감(입회자) 서명 보장 (실제 등록 서명 또는 직인 도장 Data URL)
  let vpSignature = '';
  try {
    const sigMap = await getTeacherSignaturesDirectory();
    const emailKey = (resolvedEmail || '').toLowerCase().trim();
    const nameKey = (resolvedName || '').trim();
    const registeredSig =
      (emailKey && sigMap[emailKey]) || (nameKey && sigMap[nameKey]) || null;
    if (isActualSignature(registeredSig)) {
      vpSignature = registeredSig!;
    } else {
      vpSignature = getTeacherStampSignature(nameKey || '교감');
    }
  } catch {
    vpSignature = getTeacherStampSignature(resolvedName || '교감');
  }

  await updateDoc(docRef, {
    status: 'APPROVED',
    vicePrincipalName: resolvedName,
    vicePrincipalEmail: resolvedEmail || '',
    vicePrincipalSignature: vpSignature,
    approvedAt: nowIso,
    updatedAt: nowIso
  });

  // 교감 결재 완료 시 Google Drive에 PDF 저장
  // (결재 1건으로 학년도 전체 인수인계를 자동 잠그지 않는다. 마감은 교무부장/관리자가 수동 처리)
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const approvedDoc = snap.data() as FixtureHandoverDocument;
      // 비동기 드라이브 아카이빙 (결재 승인 자체는 지연 없이 보장)
      archiveFixtureDocumentToDrive(approvedDoc, resolvedName).catch(() => {});
    }
  } catch (e) {
    console.warn('[fixtureHandoverService] 결재 후 드라이브 아카이브 처리 중 경고:', e);
  }
}

/**
 * 교감(입회자) 다건 일괄 확인
 */
export async function bulkApproveFixtureDocuments(
  ids: string[],
  vpName?: string,
  vpEmail?: string
): Promise<void> {
  let resolvedName = vpName?.trim();
  let resolvedEmail = vpEmail?.trim();
  if (!resolvedName || resolvedName === '정영찬') {
    const vpInfo = await getResolvedVicePrincipalInfo();
    resolvedName = vpInfo.name;
    resolvedEmail = resolvedEmail || vpInfo.email;
  }
  await Promise.all(ids.map((id) => approveFixtureDocument(id, resolvedName, resolvedEmail)));
}

/**
 * 비품 인수인계 반려 처리
 */
export async function rejectFixtureDocument(
  id: string,
  reason: string,
  rejectedByName: string = ''
): Promise<void> {
  const docRef = doc(db, FIXTURE_COLLECTION, id);
  const nowIso = new Date().toISOString();
  await updateDoc(docRef, {
    status: 'REJECTED',
    rejectionReason: reason,
    updatedAt: nowIso
  });
}

/**
 * 초안 삭제
 */
export async function deleteFixtureDocument(id: string): Promise<void> {
  const docRef = doc(db, FIXTURE_COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * 첨부 PDF 서식과 100% 동일한 A4 1페이지 규격 HTML 생성
 */
export function generateFixtureHandoverA4Html(
  docData: FixtureHandoverDocument,
  currentVpName?: string
): string {
  const isClass = docData.type === 'CLASSROOM';
  const titleRight = isClass ? '학급 비품 인계, 인수서' : '특별실 비품 인계서';

  // 특별실명이 이미 '실'로 끝나면(예: 과학실) 서식의 '( )실'에서 '실'을 중복 표기하지 않는다
  const roomSlot = (name?: string) => {
    const clean = escapeHtml((name || '').trim());
    if (!clean) return '( &nbsp;&nbsp;&nbsp;&nbsp; )실';
    return /실$/.test(clean) ? `( ${clean} )` : `( ${clean} )실`;
  };

  const leftHeaderLine1 = isClass
    ? `${docData.year}학년도 ( ${docData.grade || '&nbsp;&nbsp;'} )학년 ( ${docData.classNum || '&nbsp;&nbsp;'} )반`
    : `${docData.year}학년도 ${roomSlot(docData.roomName)}`;

  const leftHeaderLine2 = isClass
    ? (docData.nextYearGrade && docData.nextYearClassNum
        ? `${docData.targetNextYear}학년도 ( ${docData.nextYearGrade} )학년 ( ${docData.nextYearClassNum} )반`
        : `${docData.targetNextYear}학년도 ( ${docData.grade || '&nbsp;&nbsp;'} )학년 ( ${docData.classNum || '&nbsp;&nbsp;'} )반`)
    : `${docData.targetNextYear}학년도 ${roomSlot(docData.nextYearRoomName || docData.roomName)}`;

  // 총 22개 슬롯 (좌 11개, 우 11개)
  const leftItems: (FixtureItem | null)[] = [];
  const rightItems: (FixtureItem | null)[] = [];

  for (let i = 0; i < 11; i++) {
    leftItems.push(docData.items[i] || null);
  }
  for (let i = 11; i < 22; i++) {
    rightItems.push(docData.items[i] || null);
  }

  // 날짜 분해
  const dateObj = docData.handoverDate ? new Date(docData.handoverDate) : new Date();
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();

  // 최신 교감(입회자) 성명 결정 (리더십 설정 반영, 이전 하드코딩값 '정영찬' 필터링)
  const resolvedVp =
    currentVpName?.trim() ||
    (docData.vicePrincipalName && docData.vicePrincipalName !== '정영찬' ? docData.vicePrincipalName.trim() : '') ||
    '신선영';

  // 서명 인영 렌더링 헬퍼 (도장 또는 실제 등록 도장 이미지 연동: (인) 텍스트 위에 정중앙 겹쳐서 오버랩 날인)
  const getSignImgHtml = (sig: string | undefined, name: string | undefined, isSigned: boolean) => {
    const hasValidSig = isSigned && Boolean(name && name.trim());
    let finalSig = '';
    if (hasValidSig) {
      if (sig && isActualSignature(sig)) {
        finalSig = sig;
      } else if (sig && sig.length > 50) {
        finalSig = sig;
      } else {
        finalSig = getTeacherStampSignature(name!);
      }
    }

    return `
      <div style="position: relative; display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 38px; vertical-align: middle;">
        <span style="font-size: 11.5pt; color: ${hasValidSig ? '#111' : '#64748b'}; letter-spacing: 2px; font-weight: normal;">(인)</span>
        ${hasValidSig && finalSig ? `<img src="${finalSig}" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: auto; height: auto; max-height: 38px; max-width: 56px; pointer-events: none; opacity: 0.95;" alt="${escapeHtml(name!)} 도장" />` : ''}
      </div>
    `.trim();
  };

  // 인계자: 제출 완료 또는 작성된 경우 서명 날인 보장
  const authorSignHtml = getSignImgHtml(docData.authorSignature, docData.authorName, Boolean(docData.authorName));

  // 인수자: 인수자 확인 완료(successorChecked) 또는 서명이 존재하는 경우 날인
  const isSuccessorSigned = Boolean(docData.successorName && (docData.successorChecked || docData.successorSignature));
  const successorSignHtml = getSignImgHtml(docData.successorSignature, docData.successorName, isSuccessorSigned);

  // 입회자(교감): 승인 완료(APPROVED) 또는 서명이 존재하는 경우 날인
  const isVpSigned = Boolean(resolvedVp && (docData.status === 'APPROVED' || docData.vicePrincipalSignature));
  const vpSignHtml = getSignImgHtml(docData.vicePrincipalSignature, resolvedVp, isVpSigned);

  // 행 렌더링 헬퍼 (셀 높이 1.5배: height: 38px 적용)
  const rowsHtml = leftItems
    .map((leftItem, idx) => {
      const leftNo = idx + 1;
      const rightItem = rightItems[idx];
      const rightNo = idx + 12;

      return `
      <tr>
        <td style="text-align: center; border: 1px solid #000; height: 38px; padding: 6px 2px; font-size: 11pt;">${leftItem ? leftNo : ''}</td>
        <td style="text-align: left; border: 1px solid #000; height: 38px; padding: 6px 6px; font-size: 11pt;">${leftItem ? escapeHtml(leftItem.name) : ''}</td>
        <td style="text-align: center; border: 1px solid #000; height: 38px; padding: 6px 2px; font-size: 11pt;">${leftItem ? leftItem.quantity : ''}</td>
        <td style="text-align: left; word-break: break-all; border: 1px solid #000; height: 38px; padding: 6px 4px; font-size: 10pt;">${leftItem ? escapeHtml(leftItem.note || '') : ''}</td>

        <td style="text-align: center; border: 1px solid #000; height: 38px; padding: 6px 2px; font-size: 11pt;">${rightItem ? rightNo : ''}</td>
        <td style="text-align: left; border: 1px solid #000; height: 38px; padding: 6px 6px; font-size: 11pt;">${rightItem ? escapeHtml(rightItem.name) : ''}</td>
        <td style="text-align: center; border: 1px solid #000; height: 38px; padding: 6px 2px; font-size: 11pt;">${rightItem ? rightItem.quantity : ''}</td>
        <td style="text-align: left; word-break: break-all; border: 1px solid #000; height: 38px; padding: 6px 4px; font-size: 10pt;">${rightItem ? escapeHtml(rightItem.note || '') : ''}</td>
      </tr>
    `;
    })
    .join('');

  const winPw = docData.windowsPassword?.trim() || '없음';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${isClass ? `${docData.year}학년도_${docData.grade}학년${docData.classNum}반_학급비품인수인계서` : `${docData.year}학년도_${docData.roomName}_특별실비품인계서`}</title>
  <style>
    @page {
      size: A4 portrait;
      /* 여백을 명시하지 않아 브라우저 기본 여백(Default, 약 10~12mm)이 자동 적용되도록 함 */
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Batang', 'Gungsuh', 'Malgun Gothic', 'Apple SD Gothic Neo', serif;
      color: #000;
      background: #fff;
    }
    .page-container {
      width: 100%;
      max-width: 178mm;
      min-height: 254mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .header-left {
      width: 52%;
      vertical-align: middle;
      font-size: 15pt;
      font-weight: bold;
      line-height: 1.45;
      letter-spacing: -0.5px;
    }
    .header-right {
      width: 48%;
      text-align: right;
      vertical-align: middle;
    }
    .header-right-title {
      font-size: 19pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .header-right-sub {
      font-size: 11.5pt;
      color: #111;
    }
    table.fixture-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-bottom: 10px;
    }
    table.fixture-table th {
      border: 1px solid #000;
      background-color: #f7f7f7;
      height: 34px;
      padding: 6px 2px;
      font-size: 11pt;
      font-weight: bold;
      text-align: center;
      color: #000;
    }
    table.fixture-table td {
      border: 1px solid #000;
      height: 38px; /* 기존 25px 대비 1.5배 */
      vertical-align: middle;
      color: #000;
    }
    .pw-label-cell {
      border: 1px solid #000;
      background-color: #e2f0d9;
      font-weight: bold;
      text-align: center;
      font-size: 10.5pt;
      height: 38px;
      padding: 6px 4px;
      letter-spacing: -0.3px;
      color: #000;
    }
    .pw-val-cell {
      border: 1px solid #000;
      background-color: #e2f0d9;
      font-weight: bold;
      text-align: center;
      font-size: 11pt;
      height: 38px;
      padding: 6px 4px;
      color: #000;
    }
    .statement {
      text-align: center;
      font-size: 12.5pt;
      margin-top: 14px;
      margin-bottom: 12px;
      letter-spacing: 1px;
    }
    .date-line {
      text-align: center;
      font-size: 12.5pt;
      margin-bottom: 22px;
      letter-spacing: 0.5px;
    }
    .sign-table {
      width: 480px;
      max-width: 100%;
      margin: 0 auto 20px auto;
      border-collapse: collapse;
      font-size: 12pt;
    }
    .sign-table td {
      padding: 6px 4px;
      line-height: 1.5;
      white-space: nowrap !important;
    }
    .footer-recipient {
      text-align: center;
      font-size: 17pt;
      font-weight: bold;
      letter-spacing: 2px;
      margin-top: 12px;
      margin-bottom: 12px;
    }
    .no-print-toolbar {
      position: fixed;
      top: 12px;
      right: 12px;
      background: rgba(15, 23, 42, 0.95);
      color: white;
      padding: 10px 16px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      z-index: 9999;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif;
    }
    .no-print-toolbar .guide-text {
      font-size: 12px;
      color: #94a3b8;
      border-right: 1px solid #334155;
      padding-right: 12px;
      line-height: 1.4;
    }
    .no-print-toolbar .guide-text strong {
      color: #f8fafc;
    }
    .no-print-toolbar .guide-text b {
      color: #38bdf8;
    }
    .no-print-toolbar button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 7px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
    }
    .no-print-toolbar button:hover {
      background: #1d4ed8;
    }
    @media print {
      .no-print-toolbar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <div class="guide-text">
      <strong>[인쇄 설정 안내]</strong> 여백: <b>기본</b> &nbsp;|&nbsp; 머리글/바닥글: <b>체크 해제</b> &nbsp;|&nbsp; 배경 그래픽: <b>체크 해제</b>
    </div>
    <button onclick="window.print()">인쇄 / PDF 저장</button>
    <button onclick="window.close()" style="background: #475569;">창 닫기</button>
  </div>

  <div class="page-container">
    <div>
      <!-- 상단 헤더 -->
      <table class="header-table">
        <tr>
          <td class="header-left">
            <div>${leftHeaderLine1}</div>
            <div>${leftHeaderLine2}</div>
          </td>
          <td class="header-right">
            <div class="header-right-title">${titleRight}</div>
            <div class="header-right-sub">(이상이 있는 경우 비고에 기재)</div>
          </td>
        </tr>
      </table>

      <!-- 8열 비품 목록 표 (1.5배 셀 높이) -->
      <table class="fixture-table">
        <colgroup>
          <col style="width: 6%" /><col style="width: 22%" /><col style="width: 7%" /><col style="width: 15%" />
          <col style="width: 6%" /><col style="width: 22%" /><col style="width: 7%" /><col style="width: 15%" />
        </colgroup>
        <thead>
          <tr>
            <th>번호</th>
            <th>비 품 명</th>
            <th>수량</th>
            <th>비 고</th>
            <th>번호</th>
            <th>비 품 명</th>
            <th>수량</th>
            <th>비 고</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr>
            <td style="border: 1px solid #000; height: 38px;"></td>
            <td style="border: 1px solid #000; height: 38px;"></td>
            <td style="border: 1px solid #000; height: 38px;"></td>
            <td style="border: 1px solid #000; height: 38px;"></td>
            <td colspan="3" class="pw-label-cell">★ 윈도우 로그인 비번</td>
            <td class="pw-val-cell">${escapeHtml(winPw)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 하단 서약문 및 결재 서명란 -->
    <div>
      <div class="statement">위와 같이 인계・인수 합니다.</div>
      <div class="date-line">${y} 년 &nbsp;&nbsp; ${m} 월 &nbsp;&nbsp; ${d} 일</div>

      <table class="sign-table">
        <tr>
          <td style="width: 170px; white-space: nowrap;">인계자 &nbsp;직 : &nbsp;${escapeHtml(docData.authorRole || '교사')}</td>
          <td style="width: 190px; white-space: nowrap;">성명 : &nbsp;${escapeHtml(docData.authorName || '')}</td>
          <td style="width: 120px; text-align: right; white-space: nowrap; vertical-align: middle;">${authorSignHtml}</td>
        </tr>
        <tr>
          <td style="white-space: nowrap;">인수자 &nbsp;직 : &nbsp;${escapeHtml(docData.successorRole || '교사')}</td>
          <td style="white-space: nowrap;">성명 : &nbsp;${escapeHtml(docData.successorName || '')}</td>
          <td style="text-align: right; white-space: nowrap; vertical-align: middle;">${successorSignHtml}</td>
        </tr>
        <tr>
          <td style="white-space: nowrap;">입회자 &nbsp;직 : &nbsp;${escapeHtml(docData.vicePrincipalRole || '교감')}</td>
          <td style="white-space: nowrap;">성명 : &nbsp;${escapeHtml(resolvedVp)}</td>
          <td style="text-align: right; white-space: nowrap; vertical-align: middle;">${vpSignHtml}</td>
        </tr>
      </table>

      <div class="footer-recipient">호치민시한국국제학교장 귀하</div>
    </div>
  </div>

  <script>
    window.addEventListener('DOMContentLoaded', () => {
      // 자동 인쇄 다이얼로그 호출 (사용자 편의)
      setTimeout(() => {
        window.print();
      }, 300);
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 독립 창 팝업 인쇄 실행기 (Rule 6: window.open 방식 필수 준수)
 * 학교 리더십에 등록된 최신 교감 성명을 자동 조회하여 인쇄 반영
 * 인계자/인수자/교감의 프로필 등록 실제 서명·도장 이미지를 최우선 보강
 */
export async function openFixturePrintWindow(
  docData: FixtureHandoverDocument,
  customVpName?: string,
  userProfileSignature?: string
): Promise<void> {
  let resolvedVp = customVpName?.trim();
  if (!resolvedVp) {
    if (!docData.vicePrincipalName || docData.vicePrincipalName === '정영찬') {
      const vpInfo = await getResolvedVicePrincipalInfo();
      resolvedVp = vpInfo.name;
    } else {
      resolvedVp = docData.vicePrincipalName;
    }
  }

  // 1. 인계자 프로필 서명 최우선 보강
  let authorSig = docData.authorSignature;
  if (!isActualSignature(authorSig) && isActualSignature(userProfileSignature)) {
    authorSig = userProfileSignature!;
  }

  // 2. 등록된 교원 서명 디렉터리에서 추가 보강
  if (!isActualSignature(authorSig)) {
    try {
      const sigMap = await getTeacherSignaturesDirectory();
      const authorEmailKey = (docData.authorEmail || '').trim().toLowerCase();
      const authorNameKey = (docData.authorName || '').trim();
      const regSig = (authorEmailKey && sigMap[authorEmailKey]) || (authorNameKey && sigMap[authorNameKey]);
      if (isActualSignature(regSig)) {
        authorSig = regSig;
      }
    } catch (e) {
      console.warn('[openFixturePrintWindow] 서명 디렉터리 조회 실패:', e);
    }
  }

  // 3. 인수자 서명 보강 (인수 확인 완료된 경우)
  let succSig = docData.successorSignature;
  if (docData.successorChecked && !isActualSignature(succSig)) {
    try {
      const sigMap = await getTeacherSignaturesDirectory();
      const succEmailKey = (docData.successorEmail || '').trim().toLowerCase();
      const succNameKey = (docData.successorName || '').trim();
      const regSig = (succEmailKey && sigMap[succEmailKey]) || (succNameKey && sigMap[succNameKey]);
      if (isActualSignature(regSig)) {
        succSig = regSig;
      }
    } catch {}
  }

  const enrichedDoc: FixtureHandoverDocument = {
    ...docData,
    authorSignature: authorSig || docData.authorSignature,
    successorSignature: succSig || docData.successorSignature,
  };

  const html = generateFixtureHandoverA4Html(enrichedDoc, resolvedVp);
  const win = window.open('', '_blank', 'width=880,height=1040,menubar=no,toolbar=no,location=no');
  if (!win) {
    alert('팝업 차단이 감지되었습니다. 팝업을 허용해주세요.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
