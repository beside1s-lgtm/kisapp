import type { ApprovalDoc, GoogleDriveConfig, OrgStructure } from '@/lib/types';
import { getSystemAcademicYear } from '@/lib/services/academicCalendarService';
import {
  getNormalizedTaskCompareKey,
  listDriveFilingFolderOptions,
  type DriveFilingFolderOption,
} from '@/lib/drive/deptFolderMapping';

export const REGISTRY_FOLDER_ALL = 'ALL';
export const REGISTRY_DEPT_ALL = 'ALL';
export const REGISTRY_FOLDER_UNASSIGNED = '__UNASSIGNED__';

export interface RegistryDocFolderMeta {
  folderKey: string;
  deptName: string;
  folderName: string;
  label: string;
  folderId: string;
  folderUrl: string;
  isCommon: boolean;
  isUnassigned: boolean;
}

export interface RegistryFolderSummary {
  folderKey: string;
  deptName: string;
  folderName: string;
  label: string;
  folderId: string;
  folderUrl: string;
  isCommon: boolean;
  isUnassigned: boolean;
  count: number;
}

export interface RegistryDeptGroup {
  deptName: string;
  totalCount: number;
  folders: RegistryFolderSummary[];
}

function makeFolderCompareKey(deptName: string, folderName: string, folderId?: string): string {
  const cleanDept = (deptName || '').trim();
  const normTask = getNormalizedTaskCompareKey(folderName || '');
  if (cleanDept && normTask) {
    return `${cleanDept}::${normTask}`;
  }
  if (folderId && folderId.trim()) {
    return `id:${folderId.trim()}`;
  }
  return `raw:${cleanDept}::${(folderName || '').trim()}`;
}

/**
 * 연도별·조직도 기반 편철 문서함 전체 옵션 목록을 수집한다(선택 연도가 '전체'이면 보유 연도 전체 병합).
 */
export function collectRegistryFilingFolderOptions(
  driveConfig: GoogleDriveConfig | null | undefined,
  org: Partial<OrgStructure> | null | undefined,
  selectedYear: string = '전체'
): DriveFilingFolderOption[] {
  const currentYear = String(getSystemAcademicYear());
  const yearsToInspect = new Set<string>();

  if (selectedYear && selectedYear !== '전체') {
    yearsToInspect.add(selectedYear);
  } else {
    yearsToInspect.add(currentYear);
    if (driveConfig?.yearlyFolders) {
      Object.keys(driveConfig.yearlyFolders)
        .sort((a, b) => b.localeCompare(a))
        .forEach((y) => yearsToInspect.add(y));
    }
  }

  const merged: DriveFilingFolderOption[] = [];
  const seenKeys = new Set<string>();

  yearsToInspect.forEach((yr) => {
    const opts = listDriveFilingFolderOptions(driveConfig, org, yr);
    opts.forEach((opt) => {
      const canonicalKey = makeFolderCompareKey(opt.deptName, opt.folderName, opt.folderId);
      if (seenKeys.has(canonicalKey)) return;
      seenKeys.add(canonicalKey);
      merged.push(opt);
    });
  });

  return merged;
}

/**
 * 단일 결재 문서가 편철(저장)된 폴더 메타데이터를 산출한다.
 * - 기존 편철 선택 필드(driveTargetFolderId / DeptName / TaskName / FolderLabel)를 우선 활용하고,
 *   표시명이 누락된 문서는 알려진 폴더 옵션과 대조해 정규화한다.
 */
export function resolveApprovalDocFilingFolderMeta(
  doc: Partial<ApprovalDoc>,
  knownOptions: DriveFilingFolderOption[] = []
): RegistryDocFolderMeta {
  const rawId = (doc.driveTargetFolderId || '').trim();
  const rawUrl = (doc.driveTargetFolderUrl || '').trim();
  const rawLabel = (doc.driveTargetFolderLabel || '').trim();
  let deptName = (doc.driveTargetDeptName || '').trim();
  let folderName = (doc.driveTargetTaskName || '').trim();

  if (rawLabel.includes('>') && (!deptName || !folderName)) {
    const parts = rawLabel.split('>');
    if (!deptName && parts[0]) deptName = parts[0].trim();
    if (!folderName && parts.length > 1) folderName = parts.slice(1).join('>').trim();
  }

  const matchedOption = knownOptions.find((opt) => {
    if (rawId && opt.folderId && opt.folderId === rawId) return true;
    if (
      deptName &&
      folderName &&
      opt.deptName.trim() === deptName &&
      getNormalizedTaskCompareKey(opt.folderName) === getNormalizedTaskCompareKey(folderName)
    ) {
      return true;
    }
    if (rawLabel && opt.label.trim() === rawLabel) return true;
    return false;
  });

  if (matchedOption) {
    return {
      folderKey: makeFolderCompareKey(
        matchedOption.deptName,
        matchedOption.folderName,
        matchedOption.folderId || rawId
      ),
      deptName: matchedOption.deptName,
      folderName: matchedOption.folderName,
      label: matchedOption.label,
      folderId: matchedOption.folderId || rawId,
      folderUrl: rawUrl || matchedOption.folderUrl || '',
      isCommon: Boolean(matchedOption.isCommon),
      isUnassigned: false,
    };
  }

  if (deptName || folderName || rawLabel || rawId) {
    const resolvedDept =
      deptName || (folderName === '01_결재완료문서' ? '공통 문서함' : '기타 문서함');
    const resolvedFolderName =
      folderName || (rawId ? `지정 폴더 (${rawId.slice(0, 6)})` : rawLabel || resolvedDept);
    const resolvedLabel =
      rawLabel ||
      (resolvedDept && resolvedFolderName && resolvedDept !== resolvedFolderName
        ? `${resolvedDept} > ${resolvedFolderName}`
        : resolvedFolderName);

    return {
      folderKey: makeFolderCompareKey(resolvedDept, resolvedFolderName, rawId),
      deptName: resolvedDept,
      folderName: resolvedFolderName,
      label: resolvedLabel,
      folderId: rawId,
      folderUrl: rawUrl,
      isCommon: resolvedDept === '공통 문서함',
      isUnassigned: false,
    };
  }

  return {
    folderKey: REGISTRY_FOLDER_UNASSIGNED,
    deptName: '미지정',
    folderName: '폴더 미지정',
    label: '미지정 / 폴더 없음(기존 문서)',
    folderId: '',
    folderUrl: '',
    isCommon: false,
    isUnassigned: true,
  };
}

/**
 * 문서 목록과 편철 폴더 옵션을 병합해 부서별 그룹 및 폴더별 문서 건수를 산출한다.
 */
export function buildRegistryFolderDirectory(
  docs: ApprovalDoc[],
  knownOptions: DriveFilingFolderOption[] = []
): {
  folderItems: RegistryFolderSummary[];
  deptGroups: RegistryDeptGroup[];
} {
  const folderMap = new Map<string, RegistryFolderSummary>();

  const ensureFolderEntry = (meta: RegistryDocFolderMeta): RegistryFolderSummary => {
    const existing = folderMap.get(meta.folderKey);
    if (existing) {
      if (!existing.folderUrl && meta.folderUrl) existing.folderUrl = meta.folderUrl;
      if (!existing.folderId && meta.folderId) existing.folderId = meta.folderId;
      return existing;
    }
    const created: RegistryFolderSummary = {
      ...meta,
      count: 0,
    };
    folderMap.set(meta.folderKey, created);
    return created;
  };

  // 1. 설정/조직도에 등록된 편철 폴더 선등록
  knownOptions.forEach((opt) => {
    ensureFolderEntry({
      folderKey: makeFolderCompareKey(opt.deptName, opt.folderName, opt.folderId),
      deptName: opt.deptName,
      folderName: opt.folderName,
      label: opt.label,
      folderId: opt.folderId,
      folderUrl: opt.folderUrl,
      isCommon: Boolean(opt.isCommon),
      isUnassigned: false,
    });
  });

  // 2. 실제 결재 문서들의 폴더 카운트 누적 (미등록/레거시 폴더도 자동 포함)
  docs.forEach((doc) => {
    const meta = resolveApprovalDocFilingFolderMeta(doc, knownOptions);
    const entry = ensureFolderEntry(meta);
    entry.count += 1;
  });

  const allItems = Array.from(folderMap.values());
  const deptOrder: string[] = [];
  const deptBucket = new Map<string, RegistryFolderSummary[]>();

  allItems.forEach((item) => {
    if (!deptBucket.has(item.deptName)) {
      deptBucket.set(item.deptName, []);
      deptOrder.push(item.deptName);
    }
    deptBucket.get(item.deptName)!.push(item);
  });

  // 부서 정렬: 문서가 있는 부서 및 일반 부서 우선 -> 공통 문서함 -> 기타/미지정
  const getDeptPriority = (dept: string) => {
    if (dept === '미지정') return 99;
    if (dept === '기타 문서함') return 90;
    if (dept === '공통 문서함') return 80;
    return 10;
  };

  deptOrder.sort((a, b) => {
    const pDiff = getDeptPriority(a) - getDeptPriority(b);
    if (pDiff !== 0) return pDiff;
    return 0; // 기존 조직도 순서 유지
  });

  const deptGroups: RegistryDeptGroup[] = deptOrder.map((deptName) => {
    const folders = (deptBucket.get(deptName) || []).sort((a, b) => {
      if (a.count > 0 && b.count === 0) return -1;
      if (a.count === 0 && b.count > 0) return 1;
      return b.count - a.count;
    });
    const totalCount = folders.reduce((sum, f) => sum + f.count, 0);
    return {
      deptName,
      totalCount,
      folders,
    };
  });

  const orderedItems = deptGroups.flatMap((g) => g.folders);
  return {
    folderItems: orderedItems,
    deptGroups,
  };
}

/**
 * 문서가 선택된 부서/편철 폴더 필터 조건과 일치하는지 판별한다.
 */
export function doesDocMatchRegistryFolderFilter(
  doc: Partial<ApprovalDoc>,
  selectedFolderKey: string,
  selectedDeptName: string,
  knownOptions: DriveFilingFolderOption[] = []
): boolean {
  if (
    (!selectedFolderKey || selectedFolderKey === REGISTRY_FOLDER_ALL) &&
    (!selectedDeptName || selectedDeptName === REGISTRY_DEPT_ALL)
  ) {
    return true;
  }

  const meta = resolveApprovalDocFilingFolderMeta(doc, knownOptions);
  if (selectedFolderKey && selectedFolderKey !== REGISTRY_FOLDER_ALL) {
    return meta.folderKey === selectedFolderKey;
  }
  if (selectedDeptName && selectedDeptName !== REGISTRY_DEPT_ALL) {
    return meta.deptName === selectedDeptName;
  }
  return true;
}

export type RegistryDocNoSortOrder = 'desc' | 'asc';

function extractDocNoSortMeta(doc: Partial<ApprovalDoc>): {
  hasDocNo: boolean;
  yearNum: number;
  seqNum: number | null;
  docNoNorm: string;
  timeMs: number;
} {
  const rawDocNo = (doc.docNo || '').trim();
  const hasDocNo = Boolean(rawDocNo);

  const yearInDocNo = rawDocNo.match(/\b(20\d{2})\b/);
  const fallbackDateStr = String(doc.completedAt || doc.createdAt || '');
  const yearInDate = fallbackDateStr.match(/^(\d{4})/);
  const yearNum = yearInDocNo
    ? Number(yearInDocNo[1])
    : yearInDate
      ? Number(yearInDate[1])
      : 0;

  const seqMatch = rawDocNo.match(/(\d+)\s*$/);
  const seqNum = seqMatch ? Number(seqMatch[1]) : null;

  const timeRaw = doc.completedAt || doc.createdAt;
  const parsedTime = typeof timeRaw === 'string' ? new Date(timeRaw).getTime() : NaN;
  const timeMs = Number.isNaN(parsedTime) ? 0 : parsedTime;

  return {
    hasDocNo,
    yearNum,
    seqNum,
    docNoNorm: rawDocNo,
    timeMs,
  };
}

/**
 * 문서등록대장 문서를 문서번호순(연도 -> 문서 일련번호 숫자 -> 자연 문자열 -> 완료일시)으로 정렬한다.
 */
export function compareApprovalDocsByDocNo(
  a: Partial<ApprovalDoc>,
  b: Partial<ApprovalDoc>,
  order: RegistryDocNoSortOrder = 'desc'
): number {
  const metaA = extractDocNoSortMeta(a);
  const metaB = extractDocNoSortMeta(b);
  const dir = order === 'desc' ? -1 : 1;

  if (metaA.hasDocNo !== metaB.hasDocNo) {
    return metaA.hasDocNo ? -1 : 1;
  }

  if (metaA.yearNum !== metaB.yearNum) {
    return (metaA.yearNum - metaB.yearNum) * dir;
  }

  if (metaA.seqNum !== null && metaB.seqNum !== null && metaA.seqNum !== metaB.seqNum) {
    return (metaA.seqNum - metaB.seqNum) * dir;
  }

  if (metaA.docNoNorm !== metaB.docNoNorm) {
    return (
      metaA.docNoNorm.localeCompare(metaB.docNoNorm, 'ko', {
        numeric: true,
        sensitivity: 'base',
      }) * dir
    );
  }

  return (metaA.timeMs - metaB.timeMs) * dir;
}
