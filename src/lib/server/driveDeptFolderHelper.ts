import { getGoogleDriveClient } from '@/lib/server/googleAuth';
import type { GoogleDriveYearFolders } from '@/lib/types';

interface ResolveArchiveFolderParams {
  drive: ReturnType<typeof getGoogleDriveClient>;
  academicYear: string;
  deptName: string;
  folderName: string;
  legacyNames: string[];
  requestedTargetFolderId?: string | null;
  rootFolderId?: string | null;
  allowGlobalDirectCreate?: boolean;
  logPrefix?: string;
}

/**
 * 아카이빙 API 공용: {학년도}/{부서명}/{업무폴더} 경로를 우선 검증·탐색·이동·생성하여
 * 최종 업로드 대상 folderId / folderUrl을 확정한다.
 */
export async function resolveDeptArchiveFolder({
  drive,
  academicYear,
  deptName,
  folderName,
  legacyNames,
  requestedTargetFolderId,
  rootFolderId,
  allowGlobalDirectCreate = false,
  logPrefix = '[driveDeptFolderHelper]',
}: ResolveArchiveFolderParams): Promise<{ folderId: string | null; folderUrl: string | null }> {
  const yearFolderName = `${academicYear}학년도`;
  const allCandidateNames = Array.from(new Set([folderName, ...legacyNames]));

  const makeUrl = (id: string, link?: string | null) =>
    link || `https://drive.google.com/drive/folders/${id}`;

  const matchByNameOrKeyword = (files: Array<{ id?: string | null; name?: string | null; webViewLink?: string | null }>) => {
    for (const cname of allCandidateNames) {
      const exact = files.find(f => f.name === cname);
      if (exact?.id) return exact;
    }
    const baseKeyword = folderName.replace(/\(.*\)$/, '').trim();
    if (baseKeyword.length >= 2) {
      const partial = files.find(f => f.name && f.name.includes(baseKeyword));
      if (partial?.id) return partial;
    }
    return undefined;
  };

  // 1. 클라이언트에서 직접 전달받은 targetFolderId 유효성 검증
  if (requestedTargetFolderId) {
    try {
      const checkRes = await drive.files.get({
        fileId: requestedTargetFolderId,
        fields: 'id, name, webViewLink, trashed',
        supportsAllDrives: true,
      });
      if (checkRes.data && !checkRes.data.trashed && checkRes.data.id) {
        return {
          folderId: checkRes.data.id,
          folderUrl: makeUrl(checkRes.data.id, checkRes.data.webViewLink),
        };
      }
    } catch (err) {
      console.warn(`${logPrefix} 전달받은 targetFolderId 접근 실패, 부서 폴더 자동 탐색 진행:`, err);
    }
  }

  // 2. rootFolderId 기준: {academicYear}학년도 -> {deptName} -> {folderName} 탐색/이동/생성
  if (rootFolderId) {
    try {
      const rootList = await drive.files.list({
        q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, webViewLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const rootFiles = rootList.data.files || [];
      let yearFolderId = rootFiles.find(f => f.name === yearFolderName)?.id || null;

      if (!yearFolderId) {
        const newYf = await drive.files.create({
          requestBody: {
            name: yearFolderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootFolderId],
          },
          fields: 'id',
          supportsAllDrives: true,
        });
        yearFolderId = newYf.data.id || null;
      }

      if (yearFolderId) {
        const yearChildrenRes = await drive.files.list({
          q: `'${yearFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          pageSize: 200,
          fields: 'files(id, name, webViewLink)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        const yearChildren = yearChildrenRes.data.files || [];

        // 2-1. 부서 폴더 확보
        let deptFolderId = yearChildren.find(f => f.name === deptName)?.id || null;
        if (!deptFolderId) {
          const newDf = await drive.files.create({
            requestBody: {
              name: deptName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [yearFolderId],
            },
            fields: 'id',
            supportsAllDrives: true,
          });
          deptFolderId = newDf.data.id || null;
        }

        if (deptFolderId) {
          // 2-2. 부서 폴더 내부 검색
          const deptChildrenRes = await drive.files.list({
            q: `'${deptFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            pageSize: 200,
            fields: 'files(id, name, webViewLink)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });
          const deptMatch = matchByNameOrKeyword(deptChildrenRes.data.files || []);
          if (deptMatch?.id) {
            return {
              folderId: deptMatch.id,
              folderUrl: makeUrl(deptMatch.id, deptMatch.webViewLink),
            };
          }

          // 2-3. 학년도 직속에 레거시 폴더가 남아 있다면 부서 폴더로 이동
          const legacyDirect = matchByNameOrKeyword(yearChildren);
          if (legacyDirect?.id) {
            try {
              const moved = await drive.files.update({
                fileId: legacyDirect.id,
                addParents: deptFolderId,
                removeParents: yearFolderId,
                requestBody: { name: folderName },
                fields: 'id, name, webViewLink',
                supportsAllDrives: true,
              });
              const movedId = moved.data.id || legacyDirect.id;
              return {
                folderId: movedId,
                folderUrl: makeUrl(movedId, moved.data.webViewLink || legacyDirect.webViewLink),
              };
            } catch (moveErr) {
              console.warn(`${logPrefix} 레거시 폴더 이동 실패, 부서 하위 신규 생성으로 대체:`, moveErr);
            }
          }

          // 2-4. 부서 폴더 하위에 신규 생성
          const newTaskFolder = await drive.files.create({
            requestBody: {
              name: folderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [deptFolderId],
            },
            fields: 'id, webViewLink',
            supportsAllDrives: true,
          });
          if (newTaskFolder.data.id) {
            return {
              folderId: newTaskFolder.data.id,
              folderUrl: makeUrl(newTaskFolder.data.id, newTaskFolder.data.webViewLink),
            };
          }
        }
      }
    } catch (fErr) {
      console.warn(`${logPrefix} 루트 폴더 탐색 경고, 대체 검색 진행:`, fErr);
    }
  }

  // 3. 전체 드라이브 이름으로 폴백 검색 (신규 명칭 및 레거시 명칭 모두 허용)
  try {
    const nameClauses = allCandidateNames.map(n => `name = '${n.replace(/'/g, "\\'")}'`).join(' or ');
    const searchRes = await drive.files.list({
      q: `(${nameClauses}) and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const first = searchRes.data.files?.[0];
    if (first?.id) {
      return {
        folderId: first.id,
        folderUrl: makeUrl(first.id, first.webViewLink),
      };
    }
  } catch (searchErr) {
    console.warn(`${logPrefix} 전역 폴더 검색 실패:`, searchErr);
  }

  // 4. 최후의 수단 (안전점검표 등 직접 생성 허용 시): 학년도 -> 부서 -> 업무폴더
  if (allowGlobalDirectCreate) {
    try {
      const yearSearchRes = await drive.files.list({
        q: `name = '${yearFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const foundYearId = yearSearchRes.data.files?.[0]?.id;
      if (foundYearId) {
        const yearChildrenRes = await drive.files.list({
          q: `'${foundYearId}' in parents and name = '${deptName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        let deptId = yearChildrenRes.data.files?.[0]?.id;
        if (!deptId) {
          const createdDept = await drive.files.create({
            requestBody: {
              name: deptName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [foundYearId],
            },
            fields: 'id',
            supportsAllDrives: true,
          });
          deptId = createdDept.data.id || undefined;
        }
        if (deptId) {
          const createdTask = await drive.files.create({
            requestBody: {
              name: folderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [deptId],
            },
            fields: 'id, webViewLink',
            supportsAllDrives: true,
          });
          if (createdTask.data.id) {
            return {
              folderId: createdTask.data.id,
              folderUrl: makeUrl(createdTask.data.id, createdTask.data.webViewLink),
            };
          }
        }
      }

      const directCreateRes = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });
      if (directCreateRes.data.id) {
        return {
          folderId: directCreateRes.data.id,
          folderUrl: makeUrl(directCreateRes.data.id, directCreateRes.data.webViewLink),
        };
      }
    } catch (directErr) {
      console.error(`${logPrefix} 폴더 직접 생성 실패:`, directErr);
    }
  }

  return { folderId: null, folderUrl: null };
}

/**
 * 인수인계서 최종 승인 시점(예: 2026학년도 말 -> 2027학년도)에 다음 학년도 루트 하위 폴더와
 * '인수인계' 폴더를 즉시 탐색·자동 생성하고, 공통 폴더 메타(yearlyFolders)를 함께 반환한다.
 */
export async function resolveOrCreateYearHandoverFolder(params: {
  drive: ReturnType<typeof getGoogleDriveClient>;
  targetYear: string;
  rootFolderId?: string | null;
  existingYearFolders?: Partial<GoogleDriveYearFolders> | null;
  logPrefix?: string;
}): Promise<{
  targetFolderId: string | null;
  targetFolderUrl: string | null;
  yearFolders: GoogleDriveYearFolders | null;
}> {
  const {
    drive,
    targetYear,
    rootFolderId,
    existingYearFolders,
    logPrefix = '[resolveOrCreateYearHandoverFolder]',
  } = params;

  const makeUrl = (id: string, link?: string | null) =>
    link || `https://drive.google.com/drive/folders/${id}`;

  const yearFolderName = `${targetYear}학년도`;

  const verifyFolderAlive = async (folderId?: string | null) => {
    if (!folderId) return null;
    try {
      const check = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, webViewLink, trashed',
        supportsAllDrives: true,
      });
      if (check.data?.id && !check.data.trashed) {
        return {
          id: check.data.id,
          url: makeUrl(check.data.id, check.data.webViewLink),
        };
      }
    } catch {
      // recreate or search below
    }
    return null;
  };

  // 1. 기존에 이미 검증·저장된 차년도 인수인계 폴더가 살아 있으면 즉시 사용
  const existingHandover = await verifyFolderAlive(existingYearFolders?.handoverDoneId);
  if (existingHandover && existingYearFolders?.yearFolderId) {
    return {
      targetFolderId: existingHandover.id,
      targetFolderUrl: existingHandover.url,
      yearFolders: {
        ...(existingYearFolders as GoogleDriveYearFolders),
        yearFolderId: existingYearFolders.yearFolderId,
        yearFolderUrl: existingYearFolders.yearFolderUrl || makeUrl(existingYearFolders.yearFolderId),
        handoverDoneId: existingHandover.id,
        handoverDoneUrl: existingHandover.url,
      },
    };
  }

  // 2. 차년도 폴더('{targetYear}학년도') 확보 또는 신규 생성
  let yearFolder = await verifyFolderAlive(existingYearFolders?.yearFolderId);

  if (!yearFolder && rootFolderId) {
    const rootChildrenRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      pageSize: 200,
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const rootChildren = rootChildrenRes.data.files || [];
    const matchedYear =
      rootChildren.find(f => f.name === yearFolderName) ||
      rootChildren.find(f => f.name === `${targetYear}년` || f.name === targetYear) ||
      rootChildren.find(f => f.name && f.name.startsWith(yearFolderName));

    if (matchedYear?.id) {
      yearFolder = { id: matchedYear.id, url: makeUrl(matchedYear.id, matchedYear.webViewLink) };
    } else {
      const createdYear = await drive.files.create({
        requestBody: {
          name: yearFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId],
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });
      if (createdYear.data.id) {
        yearFolder = {
          id: createdYear.data.id,
          url: makeUrl(createdYear.data.id, createdYear.data.webViewLink),
        };
      }
    }
  } else if (!yearFolder) {
    // rootFolderId 없이도 전역 검색으로 차년도 폴더 탐색 시도
    try {
      const searchYear = await drive.files.list({
        q: `(name = '${yearFolderName}' or name = '${targetYear}년') and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, webViewLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const firstYear = searchYear.data.files?.[0];
      if (firstYear?.id) {
        yearFolder = { id: firstYear.id, url: makeUrl(firstYear.id, firstYear.webViewLink) };
      }
    } catch (err) {
      console.warn(`${logPrefix} 전역 차년도 폴더 검색 실패:`, err);
    }
  }

  if (!yearFolder) {
    return { targetFolderId: null, targetFolderUrl: null, yearFolders: null };
  }

  // 3. 차년도 폴더 하위에서 '인수인계' 폴더(및 공통 01/02 폴더) 확인/생성
  const yearChildrenRes = await drive.files.list({
    q: `'${yearFolder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    pageSize: 200,
    fields: 'files(id, name, webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const yearChildren = yearChildrenRes.data.files || [];

  const ensureChild = async (
    preferredName: string,
    matchNames: string[],
    keyword: string
  ): Promise<{ id: string; url: string }> => {
    const matched =
      yearChildren.find(f => f.id && matchNames.includes((f.name || '').trim())) ||
      yearChildren.find(f => f.id && f.name && f.name.includes(keyword));
    if (matched?.id) {
      return { id: matched.id, url: makeUrl(matched.id, matched.webViewLink) };
    }
    const created = await drive.files.create({
      requestBody: {
        name: preferredName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [yearFolder!.id],
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    const cid = created.data.id!;
    return { id: cid, url: makeUrl(cid, created.data.webViewLink) };
  };

  const [approvalDone, taskWork, handoverDone] = await Promise.all([
    existingYearFolders?.approvalDoneId
      ? Promise.resolve({
          id: existingYearFolders.approvalDoneId,
          url: existingYearFolders.approvalDoneUrl || makeUrl(existingYearFolders.approvalDoneId),
        })
      : ensureChild('01_결재완료문서', ['01_결재완료문서'], '결재완료문서'),
    existingYearFolders?.taskWorkId
      ? Promise.resolve({
          id: existingYearFolders.taskWorkId,
          url: existingYearFolders.taskWorkUrl || makeUrl(existingYearFolders.taskWorkId),
        })
      : ensureChild('02_업무작업문서(시트_첨부파일)', ['02_업무작업문서(시트_첨부파일)'], '업무작업문서'),
    existingHandover
      ? Promise.resolve(existingHandover)
      : ensureChild('인수인계', ['인수인계', '03_인수인계', '학년 말 인수인계'], '인수인계'),
  ]);

  const mergedYearFolders: GoogleDriveYearFolders = {
    ...(existingYearFolders || {}),
    yearFolderId: yearFolder.id,
    yearFolderUrl: yearFolder.url,
    approvalDoneId: approvalDone.id,
    approvalDoneUrl: approvalDone.url,
    taskWorkId: taskWork.id,
    taskWorkUrl: taskWork.url,
    handoverDoneId: handoverDone.id,
    handoverDoneUrl: handoverDone.url,
    lastSyncedAt: existingYearFolders?.lastSyncedAt || new Date().toISOString(),
  };

  return {
    targetFolderId: handoverDone.id,
    targetFolderUrl: handoverDone.url,
    yearFolders: mergedYearFolders,
  };
}
