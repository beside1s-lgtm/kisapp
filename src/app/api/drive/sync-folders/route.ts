import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveClient } from '@/lib/server/googleAuth';
import {
  buildDepartmentSyncPlans,
  getNormalizedTaskCompareKey,
  isLegacyGradeMaterialsFolderName,
  resolveSpecialDutyDepartment,
  type DepartmentDriveSyncPlan,
  type DepartmentDriveTaskPlan,
} from '@/lib/drive/deptFolderMapping';
import type {
  GoogleDriveDepartmentFolder,
  GoogleDriveTaskFolder,
  GoogleDriveYearFolders,
  OrgStructure,
} from '@/lib/types';
import { denyIfNotStaff } from '@/lib/server/staffRequestAuth';

interface DriveFileItem {
  id?: string | null;
  name?: string | null;
  webViewLink?: string | null;
}

interface FolderDef {
  key: 'approvalDone' | 'taskWork' | 'absenceDone' | 'fieldTripDone';
  name: string;
}

const LEGACY_REQUIRED_FOLDERS: FolderDef[] = [
  { key: 'approvalDone', name: '01_결재완료문서' },
  { key: 'taskWork', name: '02_업무작업문서(시트_첨부파일)' },
  { key: 'absenceDone', name: '03_결석계(완료)' },
  { key: 'fieldTripDone', name: '04_체험학습신청서(완료)' },
];

const COMMON_YEAR_FOLDERS: Array<{ key: 'approvalDone' | 'taskWork' | 'handoverDone'; name: string; keywords: string[] }> = [
  { key: 'approvalDone', name: '01_결재완료문서', keywords: ['결재완료문서'] },
  { key: 'taskWork', name: '02_업무작업문서(시트_첨부파일)', keywords: ['업무작업문서'] },
  { key: 'handoverDone', name: '인수인계', keywords: ['인수인계'] },
];

function makeFolderUrl(id: string, webViewLink?: string | null): string {
  return webViewLink || `https://drive.google.com/drive/folders/${id}`;
}

async function listChildFolders(
  drive: ReturnType<typeof getGoogleDriveClient>,
  parentId: string
): Promise<DriveFileItem[]> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    pageSize: 200,
    fields: 'files(id, name, webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

async function createFolder(
  drive: ReturnType<typeof getGoogleDriveClient>,
  name: string,
  parentId: string
): Promise<{ id: string; url: string; name: string }> {
  const cr = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });
  const id = cr.data.id!;
  return {
    id,
    name: cr.data.name || name,
    url: makeFolderUrl(id, cr.data.webViewLink),
  };
}

/**
 * 목록에서 타깃 폴더 또는 레거시 별칭과 일치하는 폴더 검색
 */
function findMatchingFolder(
  files: DriveFileItem[],
  targetName: string,
  legacyNames: string[] = [],
  excludedIds?: Set<string>
): DriveFileItem | undefined {
  const available = files.filter(f => f.id && (!excludedIds || !excludedIds.has(f.id)));
  // 1. 정확 일치
  const exact = available.find(f => f.name === targetName);
  if (exact) return exact;

  // 2. 레거시 이름 정확 일치
  for (const legacy of legacyNames) {
    const legacyExact = available.find(f => f.name === legacy);
    if (legacyExact) return legacyExact;
  }

  // 3. 정규화 비교 일치
  const targetNorm = getNormalizedTaskCompareKey(targetName);
  if (targetNorm) {
    const normMatch = available.find(f => f.name && getNormalizedTaskCompareKey(f.name) === targetNorm);
    if (normMatch) return normMatch;
  }

  // 4. 숫자 접두사 뗀 핵심 키워드 포함 일치 (예: "03_결석계(완료)" -> "결석계")
  for (const legacy of legacyNames) {
    const stripped = legacy.replace(/^\d+_/, '').trim();
    if (stripped.length >= 3) {
      const partial = available.find(f => f.name && f.name.includes(stripped));
      if (partial) return partial;
    }
  }

  return undefined;
}

/**
 * 레거시 모드용: 특정 부모 폴더 내에 LEGACY_REQUIRED_FOLDERS 4종 확인/생성
 */
async function syncLegacySubFolders(
  drive: ReturnType<typeof getGoogleDriveClient>,
  parentId: string
): Promise<Record<string, { id: string; url: string }>> {
  const existingFolders = await listChildFolders(drive, parentId);
  const result: Record<string, { id: string; url: string }> = {};

  for (const def of LEGACY_REQUIRED_FOLDERS) {
    const found = existingFolders.find(
      f => f.name === def.name || (f.name && f.name.includes(def.name.substring(3)))
    );
    if (found && found.id) {
      result[def.key] = { id: found.id, url: makeFolderUrl(found.id, found.webViewLink) };
    } else {
      const created = await createFolder(drive, def.name, parentId);
      result[def.key] = { id: created.id, url: created.url };
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  // 로그인한 교직원만 호출 가능
  const denied = await denyIfNotStaff(req, '[sync-folders]');
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      rootFolderId,
      academicYear,
      targetDeptNames,
      syncCommonFolders = true,
      departmentPlans,
      orgStructure,
      existingYearFolders,
    }: {
      rootFolderId?: string;
      academicYear?: string;
      targetDeptNames?: string[];
      syncCommonFolders?: boolean;
      departmentPlans?: DepartmentDriveSyncPlan[];
      orgStructure?: Partial<OrgStructure>;
      existingYearFolders?: Partial<GoogleDriveYearFolders>;
    } = body;

    if (!rootFolderId) {
      return NextResponse.json(
        { success: false, error: 'Google Drive 중앙 루트 폴더 ID가 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    const drive = getGoogleDriveClient();

    // 1. 루트 폴더 접근 가능 여부 확인
    try {
      await drive.files.get({
        fileId: rootFolderId,
        fields: 'id, name, mimeType, capabilities',
        supportsAllDrives: true,
      });
    } catch (err: any) {
      console.error('[sync-folders] 루트 폴더 접근 실패:', err);
      return NextResponse.json(
        {
          success: false,
          error: `Google Drive 루트 폴더(${rootFolderId})에 접근할 수 없습니다. 서비스 계정(${process.env.FIREBASE_CLIENT_EMAIL})을 해당 Google Drive 폴더의 '편집자'로 공유 추가했는지 확인해주세요. (상세 에러: ${err.message})`,
        },
        { status: 403 }
      );
    }

    // 2. 학년도 폴더 모드 (조직도 부서별 폴더 + 부서 하위 업무 폴더 트리)
    if (academicYear && /^\d{4}$/.test(academicYear)) {
      const yearFolderName = `${academicYear}학년도`;
      const rootFolders = await listChildFolders(drive, rootFolderId);
      const yearFolder = rootFolders.find(f => f.name === yearFolderName);

      let yearFolderId: string;
      let yearFolderUrl: string;
      if (yearFolder && yearFolder.id) {
        yearFolderId = yearFolder.id;
        yearFolderUrl = makeFolderUrl(yearFolder.id, yearFolder.webViewLink);
      } else {
        const createdYear = await createFolder(drive, yearFolderName, rootFolderId);
        yearFolderId = createdYear.id;
        yearFolderUrl = createdYear.url;
      }

      // 2-1. 학년도 폴더 직속 기존 하위 폴더 1회 스캔
      const existingYearChildren = await listChildFolders(drive, yearFolderId);
      const consumedLegacyIds = new Set<string>();

      let createdCount = 0;
      let movedCount = 0;

      // 2-2. 공통 폴더 3종 (01_결재완료문서, 02_업무작업문서, 인수인계) 확인/생성
      const commonResult: Record<string, { id: string; url: string }> = {};
      if (syncCommonFolders !== false) {
        for (const def of COMMON_YEAR_FOLDERS) {
          const found = existingYearChildren.find(
            f => f.name === def.name || (f.name && def.keywords.some(kw => f.name!.includes(kw)))
          );
          if (found && found.id) {
            commonResult[def.key] = { id: found.id, url: makeFolderUrl(found.id, found.webViewLink) };
            consumedLegacyIds.add(found.id);
          } else {
            const created = await createFolder(drive, def.name, yearFolderId);
            commonResult[def.key] = { id: created.id, url: created.url };
            consumedLegacyIds.add(created.id);
            createdCount++;
          }
        }
      }

      // 2-3. 부서별 동기화 계획 결정
      let plans: DepartmentDriveSyncPlan[] =
        Array.isArray(departmentPlans) && departmentPlans.length > 0
          ? departmentPlans
          : buildDepartmentSyncPlans(orgStructure, targetDeptNames);

      if (Array.isArray(targetDeptNames) && targetDeptNames.length > 0 && Array.isArray(departmentPlans)) {
        const targetSet = new Set(targetDeptNames.map(n => n.trim()).filter(Boolean));
        plans = plans.filter(p => targetSet.has(p.deptName.trim()));
      }

      const syncedDepartmentFolders: Record<string, GoogleDriveDepartmentFolder> = {};
      const syncedSpecialResults: Partial<GoogleDriveYearFolders> = {};
      const gradeDeptName = resolveSpecialDutyDepartment('gradeMaterials', orgStructure);
      let totalSyncedTasks = 0;

      // 2-4. 각 부서 폴더 및 하위 업무 폴더 동기화
      for (const plan of plans) {
        const deptName = plan.deptName.trim();
        if (!deptName) continue;

        let deptFolder = existingYearChildren.find(f => f.name === deptName);
        let deptFolderId: string;
        let deptFolderUrl: string;

        if (deptFolder && deptFolder.id) {
          deptFolderId = deptFolder.id;
          deptFolderUrl = makeFolderUrl(deptFolder.id, deptFolder.webViewLink);
        } else {
          const createdDept = await createFolder(drive, deptName, yearFolderId);
          deptFolderId = createdDept.id;
          deptFolderUrl = createdDept.url;
          createdCount++;
        }

        const existingDeptChildren = await listChildFolders(drive, deptFolderId);
        const isGradeDept =
          deptName === gradeDeptName || plan.tasks.some(t => /^[1-6]학년$/.test(t.folderName.trim()));

        // 학년부인 경우: 별도 '학년별/학년부 수업자료 공유' 폴더를 만들지 않고 학년부 바로 아래 학년 폴더를 연결.
        // 기존 '05_학년별 수업자료 공유' 등이 남아있는 경우 그 내부의 1~6학년 폴더만 학년부 직속으로 안전 이관 준비.
        const legacyGradeSourceFolders: Array<{ containerId: string; children: DriveFileItem[] }> = [];
        if (isGradeDept) {
          syncedSpecialResults.gradeMaterialsId = deptFolderId;
          syncedSpecialResults.gradeMaterialsUrl = deptFolderUrl;

          const legacyContainers = [
            ...existingDeptChildren.filter(f => f.id && f.name && isLegacyGradeMaterialsFolderName(f.name)),
            ...existingYearChildren.filter(f => f.id && f.name && isLegacyGradeMaterialsFolderName(f.name)),
          ];
          for (const lc of legacyContainers) {
            if (lc.id) {
              const lcChildren = await listChildFolders(drive, lc.id);
              legacyGradeSourceFolders.push({ containerId: lc.id, children: lcChildren });
            }
          }
        }

        const taskFolders: GoogleDriveTaskFolder[] = [];

        for (const taskPlan of plan.tasks as DepartmentDriveTaskPlan[]) {
          const targetTaskName = taskPlan.folderName.trim();
          if (!targetTaskName) continue;
          // '학년별/학년부 수업자료 공유' 중간 래퍼 폴더는 앞으로 생성하지 않음
          if (taskPlan.specialKey === 'gradeMaterials' || isLegacyGradeMaterialsFolderName(targetTaskName)) {
            continue;
          }

          // 1) 이미 해당 부서 폴더 하위에 존재하는지 검색
          let matched = findMatchingFolder(existingDeptChildren, targetTaskName, taskPlan.legacyNames);
          let taskId: string;
          let taskUrl: string;

          if (matched && matched.id) {
            taskId = matched.id;
            taskUrl = makeFolderUrl(matched.id, matched.webViewLink);
          } else {
            // 2) 학년부 내 각 학년 폴더인데 구버전 '05_학년별 수업자료 공유' 내부에 기존 학년 폴더가 있다면 직속 하위로 이동
            let movedFromLegacyGrade = false;
            let legacyGradeMovedId = '';
            let legacyGradeMovedUrl = '';

            if (isGradeDept && legacyGradeSourceFolders.length > 0) {
              for (const src of legacyGradeSourceFolders) {
                const gradeMatchInLegacy = src.children.find(
                  c => c.id && c.name === targetTaskName && !consumedLegacyIds.has(c.id)
                );
                if (gradeMatchInLegacy && gradeMatchInLegacy.id) {
                  try {
                    const movedRes = await drive.files.update({
                      fileId: gradeMatchInLegacy.id,
                      addParents: deptFolderId,
                      removeParents: src.containerId,
                      fields: 'id, name, webViewLink',
                      supportsAllDrives: true,
                    });
                    legacyGradeMovedId = movedRes.data.id || gradeMatchInLegacy.id;
                    legacyGradeMovedUrl = makeFolderUrl(
                      legacyGradeMovedId,
                      movedRes.data.webViewLink || gradeMatchInLegacy.webViewLink
                    );
                    consumedLegacyIds.add(gradeMatchInLegacy.id);
                    movedCount++;
                    movedFromLegacyGrade = true;
                    break;
                  } catch (moveErr) {
                    console.warn(`[sync-folders] 구버전 학년 폴더(${targetTaskName}) 이동 실패:`, moveErr);
                  }
                }
              }
            }

            if (movedFromLegacyGrade && legacyGradeMovedId) {
              taskId = legacyGradeMovedId;
              taskUrl = legacyGradeMovedUrl;
            } else {
              // 3) 특화 폴더인 경우, 기존에 학년도 폴더 직속에 생성되어 있던 레거시 폴더가 있다면 부서 하위로 이동
              const legacyDirect =
                taskPlan.specialKey && taskPlan.legacyNames?.length
                  ? findMatchingFolder(existingYearChildren, targetTaskName, taskPlan.legacyNames, consumedLegacyIds)
                  : undefined;

              if (legacyDirect && legacyDirect.id) {
                try {
                  const movedRes = await drive.files.update({
                    fileId: legacyDirect.id,
                    addParents: deptFolderId,
                    removeParents: yearFolderId,
                    requestBody: { name: targetTaskName },
                    fields: 'id, name, webViewLink',
                    supportsAllDrives: true,
                  });
                  taskId = movedRes.data.id || legacyDirect.id;
                  taskUrl = makeFolderUrl(taskId, movedRes.data.webViewLink || legacyDirect.webViewLink);
                  consumedLegacyIds.add(legacyDirect.id);
                  movedCount++;
                } catch (moveErr) {
                  console.warn(
                    `[sync-folders] 레거시 폴더(${legacyDirect.name}) 이동 실패, 부서 하위 신규 생성으로 대체:`,
                    moveErr
                  );
                  const createdTask = await createFolder(drive, targetTaskName, deptFolderId);
                  taskId = createdTask.id;
                  taskUrl = createdTask.url;
                  createdCount++;
                }
              } else {
                // 4) 부서 폴더 하위에 업무 폴더 신규 생성
                const createdTask = await createFolder(drive, targetTaskName, deptFolderId);
                taskId = createdTask.id;
                taskUrl = createdTask.url;
                createdCount++;
              }
            }
          }

          // 학년부 하위 1~6학년 폴더를 학년별 수업자료 공유 탭(gradeSubFolders)과 직접 연결
          if (isGradeDept) {
            const gradeNumMatch = targetTaskName.match(/^([1-6])학년$/);
            if (gradeNumMatch) {
              syncedSpecialResults.gradeSubFolders = {
                ...(syncedSpecialResults.gradeSubFolders || {}),
                [gradeNumMatch[1]]: { id: taskId, url: taskUrl },
              };
            }
          } else if (taskPlan.specialKey === 'absenceDone') {
            syncedSpecialResults.absenceDoneId = taskId;
            syncedSpecialResults.absenceDoneUrl = taskUrl;
          } else if (taskPlan.specialKey === 'fieldTripDone') {
            syncedSpecialResults.fieldTripDoneId = taskId;
            syncedSpecialResults.fieldTripDoneUrl = taskUrl;
          } else if (taskPlan.specialKey === 'peResults') {
            syncedSpecialResults.peResultsId = taskId;
            syncedSpecialResults.peResultsUrl = taskUrl;
          } else if (taskPlan.specialKey === 'safetyInspection') {
            syncedSpecialResults.safetyInspectionId = taskId;
            syncedSpecialResults.safetyInspectionUrl = taskUrl;
          }

          taskFolders.push({
            name: targetTaskName,
            id: taskId,
            url: taskUrl,
            ...(taskPlan.specialKey ? { specialKey: taskPlan.specialKey } : {}),
          });
          totalSyncedTasks++;
        }

        syncedDepartmentFolders[deptName] = {
          ...(plan.deptId ? { deptId: plan.deptId } : {}),
          deptName,
          folderId: deptFolderId,
          folderUrl: deptFolderUrl,
          taskFolders,
          lastSyncedAt: new Date().toISOString(),
        };
      }

      // 2-5. 기존 yearlyFolders 상태와 안전하게 병합 (부분 동기화 시 타 부서 정보 보존)
      const mergedYearFolders: GoogleDriveYearFolders = {
        ...(existingYearFolders || {}),
        yearFolderId,
        yearFolderUrl,
        approvalDoneId: commonResult.approvalDone?.id || existingYearFolders?.approvalDoneId,
        approvalDoneUrl: commonResult.approvalDone?.url || existingYearFolders?.approvalDoneUrl,
        taskWorkId: commonResult.taskWork?.id || existingYearFolders?.taskWorkId,
        taskWorkUrl: commonResult.taskWork?.url || existingYearFolders?.taskWorkUrl,
        handoverDoneId: commonResult.handoverDone?.id || existingYearFolders?.handoverDoneId,
        handoverDoneUrl: commonResult.handoverDone?.url || existingYearFolders?.handoverDoneUrl,
        absenceDoneId: syncedSpecialResults.absenceDoneId || existingYearFolders?.absenceDoneId,
        absenceDoneUrl: syncedSpecialResults.absenceDoneUrl || existingYearFolders?.absenceDoneUrl,
        fieldTripDoneId: syncedSpecialResults.fieldTripDoneId || existingYearFolders?.fieldTripDoneId,
        fieldTripDoneUrl: syncedSpecialResults.fieldTripDoneUrl || existingYearFolders?.fieldTripDoneUrl,
        gradeMaterialsId: syncedSpecialResults.gradeMaterialsId || existingYearFolders?.gradeMaterialsId,
        gradeMaterialsUrl: syncedSpecialResults.gradeMaterialsUrl || existingYearFolders?.gradeMaterialsUrl,
        gradeSubFolders: syncedSpecialResults.gradeSubFolders
          ? { ...(existingYearFolders?.gradeSubFolders || {}), ...syncedSpecialResults.gradeSubFolders }
          : existingYearFolders?.gradeSubFolders,
        peResultsId: syncedSpecialResults.peResultsId || existingYearFolders?.peResultsId,
        peResultsUrl: syncedSpecialResults.peResultsUrl || existingYearFolders?.peResultsUrl,
        safetyInspectionId: syncedSpecialResults.safetyInspectionId || existingYearFolders?.safetyInspectionId,
        safetyInspectionUrl: syncedSpecialResults.safetyInspectionUrl || existingYearFolders?.safetyInspectionUrl,
        departmentFolders: {
          ...(existingYearFolders?.departmentFolders || {}),
          ...syncedDepartmentFolders,
        },
        lastSyncedAt: new Date().toISOString(),
      };

      const syncedDeptNames = Object.keys(syncedDepartmentFolders);
      const summaryParts = [`부서 ${syncedDeptNames.length}개`, `업무 폴더 ${totalSyncedTasks}개 동기화 완료`];
      if (movedCount > 0) summaryParts.push(`기존 폴더 ${movedCount}개 부서 하위 이동`);
      if (createdCount > 0) summaryParts.push(`신규 ${createdCount}개 생성`);

      return NextResponse.json({
        success: true,
        message: `${academicYear}학년도 ${summaryParts.join(' · ')}`,
        mode: 'yearly',
        academicYear,
        syncedDeptNames,
        syncedDeptCount: syncedDeptNames.length,
        syncedTaskCount: totalSyncedTasks,
        movedCount,
        createdCount,
        yearFolders: mergedYearFolders,
      });
    }

    // 3. 레거시 모드 (학년도 없이 루트 바로 아래)
    const subResult = await syncLegacySubFolders(drive, rootFolderId);

    return NextResponse.json({
      success: true,
      message: 'Google Drive 중앙 저장소 표준 하위 폴더 4종 동기화 완료',
      mode: 'legacy',
      subFolders: {
        approvalDoneId: subResult.approvalDone?.id,
        approvalDoneUrl: subResult.approvalDone?.url,
        taskWorkId: subResult.taskWork?.id,
        taskWorkUrl: subResult.taskWork?.url,
        absenceDoneId: subResult.absenceDone?.id,
        absenceDoneUrl: subResult.absenceDone?.url,
        fieldTripDoneId: subResult.fieldTripDone?.id,
        fieldTripDoneUrl: subResult.fieldTripDone?.url,
      },
    });
  } catch (error: any) {
    console.error('[sync-folders] 처리 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '하위 폴더 동기화 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
