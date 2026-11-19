import type { GoogleDriveConfig, GoogleDriveYearFolders, OrgStructure } from '@/lib/types';

export type SpecialTaskFolderKey =
  | 'absenceDone'
  | 'fieldTripDone'
  | 'gradeMaterials'
  | 'peResults'
  | 'safetyInspection';

export interface DepartmentDriveTaskPlan {
  folderName: string;
  legacyNames: string[];
  specialKey?: SpecialTaskFolderKey;
}

export interface DepartmentDriveSyncPlan {
  deptId?: string;
  deptName: string;
  tasks: DepartmentDriveTaskPlan[];
}

export interface SystemBaseDutyDriveSpec {
  key: string;
  folderName: string;
  defaultDept: string;
  specialKey?: SpecialTaskFolderKey;
  legacyNames?: string[];
  canonicalAliases?: string[];
}

export const SYSTEM_BASE_DUTY_DRIVE_SPECS: SystemBaseDutyDriveSpec[] = [
  {
    key: 'pe',
    folderName: '체육 측정 결과',
    defaultDept: '예체능방과후부',
    specialKey: 'peResults',
    legacyNames: ['06_체육 측정 결과', '체육 측정 결과', '체육측정결과'],
    canonicalAliases: ['학교체육', '학교 체육', '체육교사', '체육 측정 결과', '체육측정결과', '학교 체육/PAPS 관리'],
  },
  {
    key: 'safety',
    folderName: '안전점검표',
    defaultDept: '자치생활부',
    specialKey: 'safetyInspection',
    legacyNames: ['07_안전점검표', '안전점검표'],
    canonicalAliases: ['안전지도', '안전지도 담당자', '학생 안전지도 관리', '안전점검표'],
  },
  {
    key: 'health',
    folderName: '학생 건강(보건실)',
    defaultDept: '자치생활부',
    canonicalAliases: ['보건교사', '학생 건강', '학생 건강/보건실 관리', '보건실'],
  },
  {
    key: 'afterschool',
    folderName: '방과후학교',
    defaultDept: '예체능방과후부',
    canonicalAliases: ['방과후학교', '방과후학교 담당자', '방과후학교 총괄 관리'],
  },
  {
    key: 'bus',
    folderName: '스쿨버스 운영',
    defaultDept: '예체능방과후부',
    canonicalAliases: ['스쿨버스', '스쿨버스 담당자', '스쿨버스 운영 관리', '스쿨버스 운영'],
  },
  {
    key: 'system',
    folderName: '시스템 설정',
    defaultDept: '교무기획부',
    canonicalAliases: ['시스템설정', '시스템 설정', '시스템 설정 관리', '시스템 설정 담당자'],
  },
  {
    key: 'special',
    folderName: '특수교육(도움반)',
    defaultDept: '수업연구부',
    canonicalAliases: ['특수교사', '도움반', '특수교육', '특수교육 지원 관리', '특수교육(도움반)'],
  },
  {
    key: 'librarian',
    folderName: '도서관(사서)',
    defaultDept: '교육과정기획부',
    canonicalAliases: ['사서교사', '도서관', '도서관/사서', '도서관/사서 관리'],
  },
  {
    key: 'handover',
    folderName: '학년 말 인수인계',
    defaultDept: '교무기획부',
    canonicalAliases: ['인수인계', '학년 말 인수인계', '학년 말 인수인계 총괄 관리', '학년 말 인수인계 담당'],
  },
  {
    key: 'volunteer',
    folderName: '봉사활동',
    defaultDept: '수업연구부',
    canonicalAliases: ['봉사활동', '봉사활동 담당자', '봉사활동 총괄 관리'],
  },
];

export const SPECIAL_FOLDER_DEFS: Record<
  SpecialTaskFolderKey,
  { folderName: string; legacyNames: string[]; defaultDept: string }
> = {
  absenceDone: {
    folderName: '결석계(완료)',
    legacyNames: ['03_결석계(완료)', '결석계(완료)', '결석계'],
    defaultDept: '교무기획부',
  },
  fieldTripDone: {
    folderName: '체험학습신청서(완료)',
    legacyNames: ['04_체험학습신청서(완료)', '체험학습신청서(완료)', '체험학습신청서'],
    defaultDept: '교무기획부',
  },
  gradeMaterials: {
    folderName: '학년별 수업자료 공유',
    legacyNames: ['05_학년별 수업자료 공유', '학년별 수업자료 공유', '학년별 수업자료'],
    defaultDept: '학년부',
  },
  peResults: {
    folderName: '체육 측정 결과',
    legacyNames: ['06_체육 측정 결과', '체육 측정 결과', '체육측정결과'],
    defaultDept: '예체능방과후부',
  },
  safetyInspection: {
    folderName: '안전점검표',
    legacyNames: ['07_안전점검표', '안전점검표'],
    defaultDept: '자치생활부',
  },
};

/**
 * 구버전 중간 래퍼 폴더명('학년별 수업자료 공유', '학년부 수업자료 공유', '05_학년별 수업자료 공유')인지 판별
 * 학년부 하위에는 각 학년(1학년~6학년 등) 폴더만 생성해야 하므로 해당 이름 생성을 차단한다.
 */
export function isLegacyGradeMaterialsFolderName(name: string): boolean {
  const norm = (name || '')
    .trim()
    .replace(/^\d+_/, '')
    .replace(/\s+/g, '');
  return (
    norm === '학년별수업자료공유' ||
    norm === '학년부수업자료공유' ||
    norm === '학년별수업자료' ||
    norm === '학년부수업자료'
  );
}

/**
 * 폴더 비교용 정규화 키 (공백, 특수기호, '담당/담당자' 접미사 제거)
 */
export function getNormalizedTaskCompareKey(name: string): string {
  return (name || '')
    .trim()
    .replace(/^\d+_/, '')
    .replace(/(담당자|담당|관리)$/g, '')
    .replace(/[\s()[\]·/\\_-]/g, '')
    .toLowerCase();
}

/**
 * 직책명이 폴더명이 아니라 순수 직위(예: 교무기획부장, 1학년 부장)인지 판별
 */
export function isLeadershipPositionRoleName(roleName: string): boolean {
  const trimmed = (roleName || '').trim();
  if (!trimmed) return true;
  if (/부장$/.test(trimmed)) return true;
  return false;
}

/**
 * 직책/업무명을 Google Drive 하위 업무 폴더용 이름으로 정제
 */
export function normalizeDutyFolderName(rawName: string): string {
  const trimmed = (rawName || '').trim();
  if (!trimmed) return '';
  const withoutSuffix = trimmed.replace(/\s*(담당자|담당)$/, '').trim();
  return withoutSuffix || trimmed;
}

/**
 * 조직도 내 부서명 해석: 정확히 일치하는 부서가 없으면 키워드 일치 부서로 폴백
 */
function findMatchingDeptName(
  org: Partial<OrgStructure> | null | undefined,
  preferredName: string,
  fallbackKeywords: string[]
): string {
  const depts = org?.departments || [];
  const exact = depts.find(d => d.name.trim() === preferredName);
  if (exact) return exact.name.trim();

  for (const kw of fallbackKeywords) {
    const partial = depts.find(d => d.name.includes(kw));
    if (partial) return partial.name.trim();
  }
  return preferredName;
}

/**
 * 5대 특화 업무 폴더(결석계, 체험학습, 수업자료, 체육측정, 안전점검표)의 실제 귀속 부서 해석
 */
export function resolveSpecialDutyDepartment(
  specialKey: SpecialTaskFolderKey,
  org?: Partial<OrgStructure> | null
): string {
  const depts = org?.departments || [];

  if (specialKey === 'peResults') {
    const assigned = org?.dutyRoleDepts?.['pe'];
    if (assigned && assigned !== 'unassigned') return assigned.trim();
    return findMatchingDeptName(org, '예체능방과후부', ['체육', '예체능', '방과후']);
  }

  if (specialKey === 'safetyInspection') {
    const assigned = org?.dutyRoleDepts?.['safety'];
    if (assigned && assigned !== 'unassigned') return assigned.trim();
    return findMatchingDeptName(org, '자치생활부', ['안전', '생활', '자치']);
  }

  if (specialKey === 'gradeMaterials') {
    const exact = depts.find(d => d.name.trim() === '학년부');
    if (exact) return exact.name.trim();
    const partial = depts.find(d => d.name.includes('학년'));
    if (partial) return partial.name.trim();
    return '학년부';
  }

  if (specialKey === 'absenceDone' || specialKey === 'fieldTripDone') {
    const keyword = specialKey === 'absenceDone' ? ['결석', '학생출결', '출결'] : ['체험학습', '학생출결', '출결'];
    const customMatch = (org?.customDutyRoles || []).find(
      r => r.deptName && r.deptName !== 'unassigned' && keyword.some(k => r.roleName.includes(k))
    );
    if (customMatch?.deptName) return customMatch.deptName.trim();
    return findMatchingDeptName(org, '교무기획부', ['교무기획', '교무']);
  }

  return '교무기획부';
}

/**
 * 학년부에 포함할 각 학년 하위 폴더명 목록 산출
 * 기본 1~6학년을 포함하며, 조직도에 유치원/중등 등이 배정된 경우 함께 포함한다.
 */
export function resolveGradeDeptFolderNames(org?: Partial<OrgStructure> | null): string[] {
  const keys = [
    ...Object.keys(org?.gradeHeads || {}),
    ...Object.keys(org?.homerooms || {}),
    ...Object.keys(org?.gradeSubjects || {}),
  ];

  const hasKindergarten = keys.some(k => k.includes('유치원'));
  const hasMiddle = keys.some(k => k.includes('중등'));

  const result: string[] = [];
  if (hasKindergarten) result.push('유치원');
  for (let g = 1; g <= 6; g++) {
    result.push(`${g}학년`);
  }
  if (hasMiddle) result.push('중등');

  return result;
}

/**
 * 조직도(부서 목록, 기본 직책 부서 배정, 커스텀 직책, 부서 과업)를 바탕으로
 * 학년도 내 부서별 폴더 및 하위 업무 폴더 동기화 계획을 생성한다.
 */
export function buildDepartmentSyncPlans(
  org?: Partial<OrgStructure> | null,
  filterDeptNames?: string[]
): DepartmentDriveSyncPlan[] {
  const deptMap = new Map<string, { deptId?: string; deptName: string; tasks: DepartmentDriveTaskPlan[]; compareKeys: Set<string> }>();

  const ensureDeptEntry = (deptName: string, deptId?: string) => {
    const cleanName = (deptName || '').trim();
    if (!cleanName) return null;
    let entry = deptMap.get(cleanName);
    if (!entry) {
      entry = {
        deptId,
        deptName: cleanName,
        tasks: [],
        compareKeys: new Set<string>(),
      };
      deptMap.set(cleanName, entry);
    } else if (deptId && !entry.deptId) {
      entry.deptId = deptId;
    }
    return entry;
  };

  const addTaskToDept = (
    deptName: string,
    task: DepartmentDriveTaskPlan,
    canonicalAliases: string[] = []
  ) => {
    const entry = ensureDeptEntry(deptName);
    if (!entry) return;
    const cleanFolder = task.folderName.trim();
    if (!cleanFolder) return;

    const mainKey = getNormalizedTaskCompareKey(cleanFolder);
    const aliasKeys = [mainKey, ...canonicalAliases.map(getNormalizedTaskCompareKey)].filter(Boolean);

    // 이미 동일/유사 의미의 폴더가 이 부서 계획에 있으면 중복 생성 방지
    const isDuplicate = aliasKeys.some(k => entry.compareKeys.has(k));
    if (isDuplicate) return;

    aliasKeys.forEach(k => entry.compareKeys.add(k));
    entry.tasks.push({
      folderName: cleanFolder,
      legacyNames: task.legacyNames || [],
      specialKey: task.specialKey,
    });
  };

  // 1. 조직도에 등록된 모든 부서 우선 등록 (순서 유지, 하위 업무가 0개여도 부서 폴더 생성 보장)
  (org?.departments || []).forEach(dept => {
    ensureDeptEntry(dept.name, dept.id);
  });

  // 2. 4대 시스템 특화 연동 업무 폴더를 해당 부서에 우선 배정
  //    (단, 학년부 수업자료는 별도 래퍼 폴더 없이 학년부 직속 각 학년 폴더로 직접 구성)
  const specialOrder: SpecialTaskFolderKey[] = [
    'absenceDone',
    'fieldTripDone',
    'peResults',
    'safetyInspection',
  ];
  specialOrder.forEach(specialKey => {
    const def = SPECIAL_FOLDER_DEFS[specialKey];
    const targetDept = resolveSpecialDutyDepartment(specialKey, org);
    const baseSpec = SYSTEM_BASE_DUTY_DRIVE_SPECS.find(s => s.specialKey === specialKey);
    addTaskToDept(
      targetDept,
      {
        folderName: def.folderName,
        legacyNames: def.legacyNames,
        specialKey,
      },
      baseSpec?.canonicalAliases || []
    );
  });

  // 2-1. 학년부 하위 각 학년별 폴더 (1학년~6학년, 및 조직도 등록 시 유치원/중등) 추가
  const gradeDeptName = resolveSpecialDutyDepartment('gradeMaterials', org);
  const gradeFolderNames = resolveGradeDeptFolderNames(org);
  gradeFolderNames.forEach(gradeFolderName => {
    addTaskToDept(gradeDeptName, {
      folderName: gradeFolderName,
      legacyNames: [gradeFolderName],
    });
  });

  // 3. 기본 10종 업무 직책 중 부서가 지정(dutyRoleDepts)된 항목 반영
  SYSTEM_BASE_DUTY_DRIVE_SPECS.forEach(spec => {
    const assignedDept = org?.dutyRoleDepts?.[spec.key];
    if (!assignedDept || assignedDept === 'unassigned') return;
    addTaskToDept(
      assignedDept,
      {
        folderName: spec.folderName,
        legacyNames: spec.legacyNames || [spec.folderName],
        specialKey: spec.specialKey,
      },
      spec.canonicalAliases || []
    );
  });

  // 4. 커스텀 업무 직책(customDutyRoles) 중 부서에 배속된 업무 반영 (~부장 직위 및 구버전 학년부 수업자료 래퍼명 제외)
  (org?.customDutyRoles || []).forEach(role => {
    if (!role.deptName || role.deptName === 'unassigned') return;
    if (isLeadershipPositionRoleName(role.roleName)) return;
    if (isLegacyGradeMaterialsFolderName(role.roleName)) return;

    const cleanFolder = normalizeDutyFolderName(role.roleName);
    if (!cleanFolder || isLegacyGradeMaterialsFolderName(cleanFolder)) return;

    // 기본 직책 별칭과 중복되는지 사전 확인 (예: '시스템 설정 담당자' vs '시스템설정', '인수인계' vs '학년 말 인수인계')
    const rawKey = getNormalizedTaskCompareKey(role.roleName);
    const cleanKey = getNormalizedTaskCompareKey(cleanFolder);
    const matchedBaseSpec = SYSTEM_BASE_DUTY_DRIVE_SPECS.find(s =>
      (s.canonicalAliases || []).some(alias => {
        const ak = getNormalizedTaskCompareKey(alias);
        return ak === rawKey || ak === cleanKey;
      })
    );

    if (matchedBaseSpec) {
      addTaskToDept(
        role.deptName,
        {
          folderName: matchedBaseSpec.folderName,
          legacyNames: matchedBaseSpec.legacyNames || [matchedBaseSpec.folderName, cleanFolder],
          specialKey: matchedBaseSpec.specialKey,
        },
        matchedBaseSpec.canonicalAliases || [cleanFolder]
      );
      return;
    }

    addTaskToDept(role.deptName, {
      folderName: cleanFolder,
      legacyNames: role.roleName.trim() !== cleanFolder ? [cleanFolder, role.roleName.trim()] : [cleanFolder],
    });
  });

  // 5. 각 부서 레거시 tasks(DepartmentTaskAssignment)에 등록된 과업 반영
  (org?.departments || []).forEach(dept => {
    (dept.tasks || []).forEach(task => {
      const cleanName = normalizeDutyFolderName(task.taskName);
      if (cleanName && !isLeadershipPositionRoleName(cleanName) && !isLegacyGradeMaterialsFolderName(cleanName)) {
        addTaskToDept(dept.name, {
          folderName: cleanName,
          legacyNames: [cleanName],
        });
      }
    });
  });

  let plans: DepartmentDriveSyncPlan[] = Array.from(deptMap.values()).map(({ deptId, deptName, tasks }) => ({
    deptId,
    deptName,
    tasks,
  }));

  if (filterDeptNames && filterDeptNames.length > 0) {
    const filterSet = new Set(filterDeptNames.map(n => n.trim()).filter(Boolean));
    plans = plans.filter(p => filterSet.has(p.deptName));
  }

  return plans;
}

export interface MatchedDriveFolderInfo {
  dutyName: string;
  deptName: string;
  folderName: string;
  folderId: string;
  folderUrl: string;
  label: string;
}

/**
 * 선택한 학년도(또는 가장 최근 동기화된 학년도)의 GoogleDriveYearFolders 반환
 */
export function pickYearFoldersForLookup(
  driveConfig: GoogleDriveConfig | null | undefined,
  year: number | string
): GoogleDriveYearFolders | undefined {
  if (!driveConfig?.yearlyFolders) return undefined;
  const direct = driveConfig.yearlyFolders[String(year)];
  if (direct?.departmentFolders && Object.keys(direct.departmentFolders).length > 0) {
    return direct;
  }
  const sortedEntries = Object.entries(driveConfig.yearlyFolders)
    .filter(([, yf]) => yf?.departmentFolders && Object.keys(yf.departmentFolders).length > 0)
    .sort(([a], [b]) => b.localeCompare(a));
  return sortedEntries[0]?.[1] || direct;
}

/**
 * 동기화된 Google Drive 부서/업무 폴더들의 모든 URL Set 수집
 */
export function collectKnownDriveTaskUrls(
  driveConfig: GoogleDriveConfig | null | undefined,
  year: number | string
): Set<string> {
  const urls = new Set<string>();
  const yf = pickYearFoldersForLookup(driveConfig, year);
  if (!yf?.departmentFolders) return urls;
  Object.values(yf.departmentFolders).forEach(df => {
    if (df.folderUrl) urls.add(df.folderUrl.trim());
    (df.taskFolders || []).forEach(tf => {
      if (tf.url) urls.add(tf.url.trim());
    });
  });
  return urls;
}

/**
 * 단일 주 업무명(예: '스쿨버스 운영 관리', '전편입', '1학년 부장')에 해당하는
 * 동기화된 Google Drive 부서 하위 업무 폴더 정보를 자동 매칭한다.
 */
export function resolveDriveFolderForDuty(
  dutyName: string,
  driveConfig: GoogleDriveConfig | null | undefined,
  year: number | string,
  preferredDeptName?: string,
  org?: Partial<OrgStructure> | null
): MatchedDriveFolderInfo | null {
  const cleanDuty = (dutyName || '').trim();
  if (!cleanDuty || !driveConfig?.enabled) return null;

  const yf = pickYearFoldersForLookup(driveConfig, year);
  if (!yf?.departmentFolders) return null;

  const deptEntries = Object.values(yf.departmentFolders);
  if (deptEntries.length === 0) return null;

  const normalizedDutyKey = getNormalizedTaskCompareKey(cleanDuty);
  const cleanedDutyName = normalizeDutyFolderName(cleanDuty);

  // 후보 타깃 명칭 & 선호 부서 수집
  const candidateNames = new Set<string>([cleanDuty, cleanedDutyName]);
  const candidateCompareKeys = new Set<string>([normalizedDutyKey, getNormalizedTaskCompareKey(cleanedDutyName)]);
  let inferredDeptName = (preferredDeptName || '').trim();

  // 1) 시스템 기본 직책 스펙 매칭 (예: '스쿨버스 운영 관리' -> '스쿨버스 운영')
  const matchedSpec = SYSTEM_BASE_DUTY_DRIVE_SPECS.find(spec => {
    const specNames = [spec.folderName, ...(spec.canonicalAliases || [])];
    return specNames.some(alias => {
      if (alias === cleanDuty) return true;
      const ak = getNormalizedTaskCompareKey(alias);
      return Boolean(ak) && ak === normalizedDutyKey;
    });
  });

  if (matchedSpec) {
    candidateNames.add(matchedSpec.folderName);
    candidateCompareKeys.add(getNormalizedTaskCompareKey(matchedSpec.folderName));
    const orgAssignedDept = org?.dutyRoleDepts?.[matchedSpec.key];
    if (orgAssignedDept && orgAssignedDept !== 'unassigned') {
      inferredDeptName = orgAssignedDept.trim();
    } else if (!inferredDeptName) {
      inferredDeptName = matchedSpec.defaultDept;
    }
  }

  // 2) 학생출결/결석/체험학습 별칭 매핑
  if (cleanDuty.includes('출결') || cleanDuty.includes('학적')) {
    ['학생출결', '결석계(완료)', '체험학습신청서(완료)'].forEach(n => {
      candidateNames.add(n);
      candidateCompareKeys.add(getNormalizedTaskCompareKey(n));
    });
  } else if (cleanDuty.includes('결석')) {
    candidateNames.add('결석계(완료)');
    candidateCompareKeys.add(getNormalizedTaskCompareKey('결석계(완료)'));
  } else if (cleanDuty.includes('체험학습')) {
    candidateNames.add('체험학습신청서(완료)');
    candidateCompareKeys.add(getNormalizedTaskCompareKey('체험학습신청서(완료)'));
  }

  // 3) 학년 추출 매핑 (예: '1학년 부장', '3학년 2반 담임', '유치원', '중등')
  const gradeMatch = cleanDuty.match(/([1-6])\s*학년/);
  if (gradeMatch) {
    const gradeFolder = `${gradeMatch[1]}학년`;
    candidateNames.add(gradeFolder);
    candidateCompareKeys.add(getNormalizedTaskCompareKey(gradeFolder));
    if (!inferredDeptName) inferredDeptName = '학년부';
  } else if (cleanDuty.includes('유치원')) {
    candidateNames.add('유치원');
    candidateCompareKeys.add(getNormalizedTaskCompareKey('유치원'));
    if (!inferredDeptName) inferredDeptName = '학년부';
  } else if (cleanDuty.includes('중등')) {
    candidateNames.add('중등');
    candidateCompareKeys.add(getNormalizedTaskCompareKey('중등'));
    if (!inferredDeptName) inferredDeptName = '학년부';
  }

  let bestMatch: { score: number; info: MatchedDriveFolderInfo } | null = null;

  for (const df of deptEntries) {
    const isPreferredDept = Boolean(
      inferredDeptName &&
        (df.deptName === inferredDeptName ||
          df.deptName.includes(inferredDeptName) ||
          inferredDeptName.includes(df.deptName))
    );
    const deptBonus = isPreferredDept ? 15 : 0;

    for (const tf of df.taskFolders || []) {
      const tfName = (tf.name || '').trim();
      const tfKey = getNormalizedTaskCompareKey(tfName);
      if (!tfName || !tf.url) continue;

      let baseScore = 0;
      if (candidateNames.has(tfName)) {
        baseScore = 100;
      } else if (tfKey && candidateCompareKeys.has(tfKey)) {
        baseScore = 90;
      } else if (
        tfKey.length >= 2 &&
        normalizedDutyKey.length >= 2 &&
        (normalizedDutyKey.includes(tfKey) || tfKey.includes(normalizedDutyKey))
      ) {
        baseScore = 70;
      }

      if (baseScore > 0) {
        const totalScore = baseScore + deptBonus;
        if (!bestMatch || totalScore > bestMatch.score) {
          bestMatch = {
            score: totalScore,
            info: {
              dutyName: cleanDuty,
              deptName: df.deptName,
              folderName: tfName,
              folderId: tf.id,
              folderUrl: tf.url,
              label: `${df.deptName} > ${tfName}`,
            },
          };
        }
      }
    }
  }

  if (bestMatch) return bestMatch.info;

  // 4) '{부서명} 총괄 업무' 또는 부서명 자체인 경우 해당 부서 폴더 URL 연결
  const strippedDept = cleanDuty.replace(/\s*(총괄\s*업무|업무)$/, '').trim();
  const deptRootMatch = deptEntries.find(
    df => df.deptName === cleanDuty || df.deptName === strippedDept
  );
  if (deptRootMatch?.folderUrl) {
    return {
      dutyName: cleanDuty,
      deptName: deptRootMatch.deptName,
      folderName: deptRootMatch.deptName,
      folderId: deptRootMatch.folderId,
      folderUrl: deptRootMatch.folderUrl,
      label: deptRootMatch.deptName,
    };
  }

  return null;
}

/**
 * 복수 주 업무명 배열을 순서대로 검사해 매칭 가능한 Google Drive 업무 폴더 목록을 반환한다.
 * 동일 폴더 URL 중복은 제거하고 대표 업무 우선 순서를 유지한다.
 */
export function resolveDriveFoldersForDuties(
  dutyNames: string[],
  driveConfig: GoogleDriveConfig | null | undefined,
  year: number | string,
  preferredDeptName?: string,
  org?: Partial<OrgStructure> | null
): MatchedDriveFolderInfo[] {
  const seenUrls = new Set<string>();
  const results: MatchedDriveFolderInfo[] = [];

  for (const duty of dutyNames || []) {
    const matched = resolveDriveFolderForDuty(duty, driveConfig, year, preferredDeptName, org);
    if (matched && !seenUrls.has(matched.folderUrl)) {
      seenUrls.add(matched.folderUrl);
      results.push(matched);
    }
  }

  return results;
}

export interface DriveFilingFolderOption {
  value: string;
  folderId: string;
  folderUrl: string;
  deptName: string;
  folderName: string;
  label: string;
  isAssignedToUser: boolean;
  isCommon?: boolean;
  isVirtual?: boolean;
}

/**
 * 새 결재문서 편철 시 선택 가능한 Google Drive 문서함 목록 구성
 * (동기화된 부서 하위 업무 폴더 + 미동기화 조직도 업무 폴백 + 공통 결재완료문서함)
 */
export function listDriveFilingFolderOptions(
  driveConfig: GoogleDriveConfig | null | undefined,
  org: Partial<OrgStructure> | null | undefined,
  year: number | string,
  myMatchedFolders: MatchedDriveFolderInfo[] = []
): DriveFilingFolderOption[] {
  if (!driveConfig && !org) return [];

  const yf = pickYearFoldersForLookup(driveConfig, year);
  const deptFoldersMap = yf?.departmentFolders || {};
  const matchedIds = new Set(myMatchedFolders.map(m => m.folderId).filter(Boolean));
  const matchedPairKeys = new Set(
    myMatchedFolders.map(m => `${m.deptName.trim()}::${getNormalizedTaskCompareKey(m.folderName)}`)
  );

  const isAssigned = (folderId: string, deptName: string, folderName: string) => {
    if (folderId && matchedIds.has(folderId)) return true;
    const pairKey = `${deptName.trim()}::${getNormalizedTaskCompareKey(folderName)}`;
    return matchedPairKeys.has(pairKey);
  };

  const results: DriveFilingFolderOption[] = [];
  const seenValues = new Set<string>();
  const seenPairKeys = new Set<string>();

  const pushOption = (opt: DriveFilingFolderOption) => {
    if (!opt.value || seenValues.has(opt.value)) return;
    const pairKey = `${opt.deptName.trim()}::${getNormalizedTaskCompareKey(opt.folderName)}`;
    if (opt.folderId && seenPairKeys.has(pairKey)) return;
    seenValues.add(opt.value);
    if (opt.folderName) seenPairKeys.add(pairKey);
    results.push(opt);
  };

  // 조직도 부서 순서 우선, 이후 나머지 동기화 부서
  const orderedDeptNames: string[] = [];
  (org?.departments || []).forEach(d => {
    const n = d.name.trim();
    if (n && !orderedDeptNames.includes(n)) orderedDeptNames.push(n);
  });
  Object.keys(deptFoldersMap).forEach(k => {
    const n = (deptFoldersMap[k]?.deptName || k).trim();
    if (n && !orderedDeptNames.includes(n)) orderedDeptNames.push(n);
  });

  // 1. 동기화된 실제 Google Drive 부서/업무 폴더 반영
  orderedDeptNames.forEach(deptName => {
    const df = deptFoldersMap[deptName] || Object.values(deptFoldersMap).find(item => item.deptName.trim() === deptName);
    if (!df) return;

    const validTasks = (df.taskFolders || []).filter(
      tf => tf.id && tf.name && !isLegacyGradeMaterialsFolderName(tf.name)
    );

    if (validTasks.length > 0) {
      validTasks.forEach(tf => {
        pushOption({
          value: tf.id,
          folderId: tf.id,
          folderUrl: tf.url || `https://drive.google.com/drive/folders/${tf.id}`,
          deptName: df.deptName,
          folderName: tf.name,
          label: `${df.deptName} > ${tf.name}`,
          isAssignedToUser: isAssigned(tf.id, df.deptName, tf.name),
          isVirtual: false,
        });
      });
    } else if (df.folderId) {
      pushOption({
        value: df.folderId,
        folderId: df.folderId,
        folderUrl: df.folderUrl || `https://drive.google.com/drive/folders/${df.folderId}`,
        deptName: df.deptName,
        folderName: df.deptName,
        label: `${df.deptName} (부서 폴더)`,
        isAssignedToUser: isAssigned(df.folderId, df.deptName, df.deptName),
        isVirtual: false,
      });
    }
  });

  // 2. 조직도에는 있으나 아직 드라이브 동기화가 안 된 업무 계획 보완 (결재 완료 시 자동 생성)
  const orgPlans = buildDepartmentSyncPlans(org);
  orgPlans.forEach(plan => {
    const df = deptFoldersMap[plan.deptName];
    plan.tasks.forEach(t => {
      if (isLegacyGradeMaterialsFolderName(t.folderName)) return;
      const pairKey = `${plan.deptName.trim()}::${getNormalizedTaskCompareKey(t.folderName)}`;
      if (seenPairKeys.has(pairKey)) return;
      seenPairKeys.add(pairKey);
      pushOption({
        value: `__virtual__:${plan.deptName}::${t.folderName}`,
        folderId: '',
        folderUrl: df?.folderUrl || driveConfig?.rootFolderUrl || '',
        deptName: plan.deptName,
        folderName: t.folderName,
        label: `${plan.deptName} > ${t.folderName}`,
        isAssignedToUser: isAssigned('', plan.deptName, t.folderName),
        isVirtual: true,
      });
    });
  });

  // 3. 학년도 공통 01_결재완료문서 폴백 옵션
  const approvalDoneId = yf?.approvalDoneId || driveConfig?.subFolders?.approvalDoneId || '';
  const approvalDoneUrl = yf?.approvalDoneUrl || driveConfig?.subFolders?.approvalDoneUrl || '';
  if (approvalDoneId || results.length === 0) {
    pushOption({
      value: approvalDoneId || '__virtual__:공통 문서함::01_결재완료문서',
      folderId: approvalDoneId,
      folderUrl: approvalDoneUrl,
      deptName: '공통 문서함',
      folderName: '01_결재완료문서',
      label: '공통 문서함 > 01_결재완료문서',
      isAssignedToUser: false,
      isCommon: true,
      isVirtual: !approvalDoneId,
    });
  }

  return results;
}

/**
 * 로그인한 사용자의 담당 업무 및 기안 맥락에 따라 기본 편철 폴더 자동 결정
 */
export function resolveDefaultFilingFolderOption(
  options: DriveFilingFolderOption[],
  params: {
    myMatchedFolders?: MatchedDriveFolderInfo[];
    teacherDeptName?: string;
    busTemplate?: boolean;
    peTemplate?: boolean;
    afterschoolMode?: string | null;
    savedFolderId?: string;
    savedDeptName?: string;
    savedTaskName?: string;
  }
): DriveFilingFolderOption | null {
  if (!options || options.length === 0) return null;

  const {
    myMatchedFolders = [],
    teacherDeptName = '',
    busTemplate = false,
    peTemplate = false,
    afterschoolMode = null,
    savedFolderId = '',
    savedDeptName = '',
    savedTaskName = '',
  } = params;

  // 1. 기존 문서에 이미 저장된 편철 폴더 복원
  if (savedFolderId) {
    const exactId = options.find(o => o.folderId === savedFolderId || o.value === savedFolderId);
    if (exactId) return exactId;
  }
  if (savedDeptName && savedTaskName) {
    const targetKey = getNormalizedTaskCompareKey(savedTaskName);
    const exactPair = options.find(
      o => o.deptName === savedDeptName && getNormalizedTaskCompareKey(o.folderName) === targetKey
    );
    if (exactPair) return exactPair;
  }

  // 2. 특수 기안 템플릿 진입 맥락 우선 매칭
  if (busTemplate) {
    const busOpt = options.find(o => o.folderName.includes('스쿨버스') || o.label.includes('스쿨버스'));
    if (busOpt) return busOpt;
  }
  if (peTemplate) {
    const peOpt = options.find(o => o.folderName.includes('체육') || o.label.includes('체육'));
    if (peOpt) return peOpt;
  }
  if (afterschoolMode === 'plan' || afterschoolMode === 'result') {
    const afterOpt = options.find(o => o.folderName.includes('방과후') || o.label.includes('방과후'));
    if (afterOpt) return afterOpt;
  }

  // 3. 로그인한 사용자의 대표 담당 업무 폴더 (최우선 기본값)
  for (const mf of myMatchedFolders) {
    const byId = mf.folderId ? options.find(o => o.folderId === mf.folderId) : undefined;
    if (byId) return byId;
    const key = getNormalizedTaskCompareKey(mf.folderName);
    const byName = options.find(
      o => o.deptName === mf.deptName && getNormalizedTaskCompareKey(o.folderName) === key
    );
    if (byName) return byName;
  }

  const assignedOpt = options.find(o => o.isAssignedToUser);
  if (assignedOpt) return assignedOpt;

  // 4. 소속 부서 첫 번째 폴더
  if (teacherDeptName) {
    const cleanDept = teacherDeptName.trim();
    const deptOpt = options.find(
      o => o.deptName === cleanDept || o.deptName.includes(cleanDept) || cleanDept.includes(o.deptName)
    );
    if (deptOpt) return deptOpt;
  }

  // 5. 공통 결재완료문서함 또는 첫 항목
  return options.find(o => o.isCommon) || options[0] || null;
}

/**
 * 선택된 문서함/부서/업무명을 인수인계 분류(HandoverItem.category)로 매핑
 */
export function inferHandoverCategoryFromTarget(
  deptName?: string,
  taskName?: string,
  duties: string[] = []
): string {
  const joined = [taskName || '', deptName || '', ...duties].join(' ');
  if (joined.includes('스쿨버스')) return '스쿨버스';
  if (joined.includes('방과후')) return '방과후학교';
  if (joined.includes('체육') || joined.includes('PAPS')) return '학교체육';
  if (joined.includes('안전')) return '학생안전';
  if (joined.includes('보건') || joined.includes('건강')) return '보건/건강';
  if (joined.includes('결석') || joined.includes('체험학습') || joined.includes('출결')) return '출결관리';
  if (joined.includes('학년') || joined.includes('학급') || joined.includes('담임')) return '학년/학급운영';
  if (joined.includes('봉사')) return '봉사활동';
  if (joined.includes('연구')) return '연구기획';
  if (joined.includes('교무') || joined.includes('시스템') || joined.includes('인수인계')) return '교무기획';
  if (joined.includes('행정') || joined.includes('비품')) return '행정/비품';
  return '일반업무';
}
