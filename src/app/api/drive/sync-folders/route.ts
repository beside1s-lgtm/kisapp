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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rootFolderId } = body;

    if (!rootFolderId) {
      return NextResponse.json({ success: false, error: 'Google Drive 중앙 루트 폴더 ID가 제공되지 않았습니다.' }, { status: 400 });
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
      return NextResponse.json({
        success: false,
        error: `Google Drive 루트 폴더(${rootFolderId})에 접근할 수 없습니다. 서비스 계정(${process.env.FIREBASE_CLIENT_EMAIL})을 해당 Google Drive 폴더의 '편집자'로 공유 추가했는지 확인해주세요. (상세 에러: ${err.message})`
      }, { status: 403 });
    }

    // 2. 루트 폴더 내 기존 하위 폴더 목록 검색
    const existingListRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const existingFolders = existingListRes.data.files || [];
    const subFolderResults: Record<string, { id: string; url: string }> = {};

    // 3. 4개 필수 폴더별로 존재 여부 확인 및 생성
    for (const def of REQUIRED_FOLDERS) {
      const found = existingFolders.find(f => f.name === def.name || (f.name && f.name.includes(def.name.substring(3))));
      if (found && found.id) {
        subFolderResults[def.key] = {
          id: found.id,
          url: found.webViewLink || `https://drive.google.com/drive/folders/${found.id}`
        };
      } else {
        // 신규 폴더 생성
        const createRes = await drive.files.create({
          requestBody: {
            name: def.name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootFolderId]
          },
          fields: 'id, name, webViewLink',
          supportsAllDrives: true
        });

        if (createRes.data.id) {
          subFolderResults[def.key] = {
            id: createRes.data.id,
            url: createRes.data.webViewLink || `https://drive.google.com/drive/folders/${createRes.data.id}`
          };
        }
      }
    }

    const subFolders = {
      approvalDoneId: subFolderResults.approvalDone?.id,
      approvalDoneUrl: subFolderResults.approvalDone?.url,
      taskWorkId: subFolderResults.taskWork?.id,
      taskWorkUrl: subFolderResults.taskWork?.url,
      absenceDoneId: subFolderResults.absenceDone?.id,
      absenceDoneUrl: subFolderResults.absenceDone?.url,
      fieldTripDoneId: subFolderResults.fieldTripDone?.id,
      fieldTripDoneUrl: subFolderResults.fieldTripDone?.url
    };

    return NextResponse.json({
      success: true,
      message: 'Google Drive 중앙 저장소 표준 하위 폴더 4종 동기화 완료',
      subFolders
    });
  } catch (error: any) {
    console.error('[sync-folders] 처리 오류:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '하위 폴더 동기화 처리 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
