import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveClient } from '@/lib/server/googleAuth';

interface FolderDef {
  key: 'approvalDone' | 'taskWork' | 'absenceDone' | 'fieldTripDone';
  name: string;
}

const REQUIRED_FOLDERS: FolderDef[] = [
  { key: 'approvalDone', name: '01_결재완료문서' },
  { key: 'taskWork', name: '02_업무작업문서(시트_첨부파일)' },
  { key: 'absenceDone', name: '03_결석계(완료)' },
  { key: 'fieldTripDone', name: '04_체험학습신청서(완료)' }
];

/**
 * 특정 부모 폴더 내에 REQUIRED_FOLDERS 4종을 확인/생성한 뒤 결과를 반환한다.
 */
async function syncSubFolders(
  drive: ReturnType<typeof getGoogleDriveClient>,
  parentId: string
): Promise<Record<string, { id: string; url: string }>> {
  const existingListRes = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  const existingFolders = existingListRes.data.files || [];
  const result: Record<string, { id: string; url: string }> = {};

  for (const def of REQUIRED_FOLDERS) {
    const found = existingFolders.find(
      f => f.name === def.name || (f.name && f.name.includes(def.name.substring(3)))
    );
    if (found && found.id) {
      result[def.key] = {
        id: found.id,
        url: found.webViewLink || `https://drive.google.com/drive/folders/${found.id}`
      };
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: def.name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true
      });
      if (createRes.data.id) {
        result[def.key] = {
          id: createRes.data.id,
          url: createRes.data.webViewLink || `https://drive.google.com/drive/folders/${createRes.data.id}`
        };
      }
    }
  }

  return result;
}

const GRADE_NAMES: Record<string, string> = {
  '1': '1학년', '2': '2학년', '3': '3학년',
  '4': '4학년', '5': '5학년', '6': '6학년'
};

/**
 * 학년도 폴더 내에 "05_학년별 수업자료 공유" 폴더와 1~6학년 하위 폴더를 확인/생성한다.
 */
async function syncGradeMaterialsFolders(
  drive: ReturnType<typeof getGoogleDriveClient>,
  yearFolderId: string
): Promise<{ mainId: string; mainUrl: string; gradeSubFolders: Record<string, { id: string; url: string }> }> {
  const GRADE_MATERIALS_NAME = '05_학년별 수업자료 공유';

  // 1. 학년도 폴더 내 기존 폴더 검색
  const listRes = await drive.files.list({
    q: `'${yearFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  const existing = listRes.data.files || [];
  let mainId: string;
  let mainUrl: string;

  const found = existing.find(f => f.name === GRADE_MATERIALS_NAME);
  if (found && found.id) {
    mainId = found.id;
    mainUrl = found.webViewLink || `https://drive.google.com/drive/folders/${found.id}`;
  } else {
    const cr = await drive.files.create({
      requestBody: { name: GRADE_MATERIALS_NAME, mimeType: 'application/vnd.google-apps.folder', parents: [yearFolderId] },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });
    mainId = cr.data.id!;
    mainUrl = cr.data.webViewLink || `https://drive.google.com/drive/folders/${mainId}`;
  }

  // 2. 1~6학년 하위 폴더 생성
  const gradeListRes = await drive.files.list({
    q: `'${mainId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  const existingGrades = gradeListRes.data.files || [];
  const gradeSubFolders: Record<string, { id: string; url: string }> = {};

  for (const [gradeKey, gradeName] of Object.entries(GRADE_NAMES)) {
    const gFound = existingGrades.find(f => f.name === gradeName);
    if (gFound && gFound.id) {
      gradeSubFolders[gradeKey] = {
        id: gFound.id,
        url: gFound.webViewLink || `https://drive.google.com/drive/folders/${gFound.id}`
      };
    } else {
      const gcr = await drive.files.create({
        requestBody: { name: gradeName, mimeType: 'application/vnd.google-apps.folder', parents: [mainId] },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true
      });
      gradeSubFolders[gradeKey] = {
        id: gcr.data.id!,
        url: gcr.data.webViewLink || `https://drive.google.com/drive/folders/${gcr.data.id}`
      };
    }
  }

  return { mainId, mainUrl, gradeSubFolders };
}

/**
 * 학년도 폴더 내에 "06_체육 측정 결과" 폴더를 확인/생성한다.
 */
async function syncPeResultsFolder(
  drive: ReturnType<typeof getGoogleDriveClient>,
  yearFolderId: string
): Promise<{ id: string; url: string }> {
  const PE_RESULTS_NAME = '06_체육 측정 결과';
  const listRes = await drive.files.list({
    q: `'${yearFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  const existing = listRes.data.files || [];
  const found = existing.find(f => f.name === PE_RESULTS_NAME);
  if (found && found.id) {
    return {
      id: found.id,
      url: found.webViewLink || `https://drive.google.com/drive/folders/${found.id}`
    };
  }
  const cr = await drive.files.create({
    requestBody: { name: PE_RESULTS_NAME, mimeType: 'application/vnd.google-apps.folder', parents: [yearFolderId] },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true
  });
  return {
    id: cr.data.id!,
    url: cr.data.webViewLink || `https://drive.google.com/drive/folders/${cr.data.id}`
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rootFolderId, academicYear } = body;
    // academicYear: "2025-2026" 형식. 없으면 학년도 폴더 없이 루트 바로 아래에 생성 (레거시)

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
        supportsAllDrives: true
      });
    } catch (err: any) {
      console.error('[sync-folders] 루트 폴더 접근 실패:', err);
      return NextResponse.json(
        {
          success: false,
          error: `Google Drive 루트 폴더(${rootFolderId})에 접근할 수 없습니다. 서비스 계정(${process.env.FIREBASE_CLIENT_EMAIL})을 해당 Google Drive 폴더의 '편집자'로 공유 추가했는지 확인해주세요. (상세 에러: ${err.message})`
        },
        { status: 403 }
      );
    }

    // 2. 학년도 폴더 모드
    if (academicYear && /^\d{4}$/.test(academicYear)) {
      // 2-1. 루트 내 학년도 폴더 검색 또는 생성 (폴더명: "2026학년도")
      const yearFolderName = `${academicYear}학년도`;
      const rootListRes = await drive.files.list({
        q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, webViewLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      const rootFolders = rootListRes.data.files || [];
      let yearFolder = rootFolders.find(f => f.name === yearFolderName);
      let yearFolderId: string;
      let yearFolderUrl: string;

      if (yearFolder && yearFolder.id) {
        yearFolderId = yearFolder.id;
        yearFolderUrl = yearFolder.webViewLink || `https://drive.google.com/drive/folders/${yearFolder.id}`;
      } else {
        // 학년도 폴더 신규 생성
        const createYearRes = await drive.files.create({
          requestBody: {
            name: yearFolderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootFolderId]
          },
          fields: 'id, name, webViewLink',
          supportsAllDrives: true
        });
        yearFolderId = createYearRes.data.id!;
        yearFolderUrl = createYearRes.data.webViewLink || `https://drive.google.com/drive/folders/${yearFolderId}`;
      }

      // 2-2. 학년도 폴더 내 4종 하위 폴더 동기화
      const subResult = await syncSubFolders(drive, yearFolderId);

      // 2-3. 학년별 수업자료 공유 폴더 동기화
      const gradeResult = await syncGradeMaterialsFolders(drive, yearFolderId);

      // 2-4. 체육 측정 결과 폴더 동기화
      const peResult = await syncPeResultsFolder(drive, yearFolderId);

      return NextResponse.json({
        success: true,
        message: `${academicYear}학년도 폴더 및 표준 하위 폴더 6종 동기화 완료`,
        mode: 'yearly',
        academicYear,
        yearFolders: {
          yearFolderId,
          yearFolderUrl,
          approvalDoneId: subResult.approvalDone?.id,
          approvalDoneUrl: subResult.approvalDone?.url,
          taskWorkId: subResult.taskWork?.id,
          taskWorkUrl: subResult.taskWork?.url,
          absenceDoneId: subResult.absenceDone?.id,
          absenceDoneUrl: subResult.absenceDone?.url,
          fieldTripDoneId: subResult.fieldTripDone?.id,
          fieldTripDoneUrl: subResult.fieldTripDone?.url,
          gradeMaterialsId: gradeResult.mainId,
          gradeMaterialsUrl: gradeResult.mainUrl,
          gradeSubFolders: gradeResult.gradeSubFolders,
          peResultsId: peResult.id,
          peResultsUrl: peResult.url
        }
      });
    }

    // 3. 레거시 모드 (학년도 없이 루트 바로 아래)
    const subResult = await syncSubFolders(drive, rootFolderId);

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
        fieldTripDoneUrl: subResult.fieldTripDone?.url
      }
    });
  } catch (error: any) {
    console.error('[sync-folders] 처리 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '하위 폴더 동기화 처리 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
