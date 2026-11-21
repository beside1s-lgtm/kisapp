import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveClient, getGoogleSheetsClient } from '@/lib/server/googleAuth';
import { resolveDeptArchiveFolder } from '@/lib/server/driveDeptFolderHelper';
import { denyIfNotStaff } from '@/lib/server/staffRequestAuth';
import { serverAcademicYearForDate } from '@/lib/server/systemAcademicYear';

export async function POST(req: NextRequest) {
  // 로그인한 교직원만 호출 가능
  const denied = await denyIfNotStaff(req, '[create-sheet]');
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      title,
      parentFolderId,
      columns,
      columnDefs,
      academicYear,
      deptName,
      folderName,
      rootFolderId,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: '업무 제목(파일명)이 제공되지 않았습니다.' }, { status: 400 });
    }

    const drive = getGoogleDriveClient();
    const sheets = getGoogleSheetsClient();

    // 저장 대상 Google Drive 폴더 확정 (사용자 지정 폴더 ID 또는 부서 하위 폴더)
    let resolvedFolderId: string | null = parentFolderId || null;
    let resolvedFolderUrl: string | null = parentFolderId
      ? `https://drive.google.com/drive/folders/${parentFolderId}`
      : null;

    if (parentFolderId || deptName || folderName) {
      // 학년도: 시스템 설정(학사 일정 관리)에서 적용한 학년도 기준
      const defaultYear = academicYear ? '' : await serverAcademicYearForDate(new Date());

      const folderRes = await resolveDeptArchiveFolder({
        drive,
        academicYear: academicYear || defaultYear,
        deptName: (deptName || '교무기획부').trim(),
        folderName: (folderName || '02_업무작업문서(시트_첨부파일)').trim(),
        legacyNames: [folderName || '02_업무작업문서(시트_첨부파일)'],
        requestedTargetFolderId: parentFolderId || undefined,
        rootFolderId: rootFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
        allowGlobalDirectCreate: Boolean(deptName && folderName),
        logPrefix: '[create-sheet]',
      });
      if (folderRes.folderId) {
        resolvedFolderId = folderRes.folderId;
        resolvedFolderUrl = folderRes.folderUrl;
      }
    }

    // 1. 헤더 목록 추출
    let headers: string[] = [];
    if (columnDefs && Array.isArray(columnDefs) && columnDefs.length > 0) {
      headers = columnDefs.map((c: any) => c.name || c.id || '').filter(Boolean);
    } else if (columns && Array.isArray(columns) && columns.length > 0) {
      headers = columns.filter(Boolean);
    }

    // 기본 헤더 fallback
    if (headers.length === 0) {
      headers = ['학년/반', '구분', '세부 내용', '담당자', '비고'];
    }

    // 2. Google Drive에 Spreadsheet 파일 생성
    const fileMetadata: any = {
      name: title.trim(),
      mimeType: 'application/vnd.google-apps.spreadsheet'
    };

    if (resolvedFolderId) {
      fileMetadata.parents = [resolvedFolderId];
    }

    const createRes = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });

    const fileId = createRes.data.id;
    if (!fileId) {
      throw new Error('Google Spreadsheet 생성 중 fileId를 받지 못했습니다.');
    }

    // 3. 1행에 헤더 기입
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers]
      }
    });

    // 4. 헤더 스타일링 (볼드 및 배경색 적용)
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: fileId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: headers.length
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.93, green: 0.95, blue: 0.99 },
                    textFormat: { bold: true, fontSize: 11 },
                    horizontalAlignment: 'CENTER'
                  }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
              }
            }
          ]
        }
      });
    } catch (styleErr) {
      console.warn('[create-sheet] 헤더 스타일링 경고 (파일 생성은 정상 완료됨):', styleErr);
    }

    // 5. 학교 도메인(@kshcm.net) 편집 권한 또는 링크가 있는 모든 사용자 편집 권한 부여
    try {
      const workspaceDomain = process.env.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN || 'kshcm.net';
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'writer',
          type: 'domain',
          domain: workspaceDomain
        },
        supportsAllDrives: true
      });
    } catch (permErr: any) {
      console.warn('[create-sheet] 도메인 권한 부여 실패, 링크 권한으로 대체 시도:', permErr.message);
      try {
        await drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'writer',
            type: 'anyone'
          },
          supportsAllDrives: true
        });
      } catch (anyoneErr: any) {
        console.warn('[create-sheet] 링크 권한 대체 실패 (소유자 권한만 유지):', anyoneErr.message);
      }
    }

    const sheetUrl = createRes.data.webViewLink || `https://docs.google.com/spreadsheets/d/${fileId}/edit?usp=sharing`;

    return NextResponse.json({
      success: true,
      fileId,
      fileName: title.trim(),
      sheetUrl,
      folderId: resolvedFolderId,
      folderUrl: resolvedFolderUrl,
      headers
    });
  } catch (error: any) {
    console.error('[create-sheet] 오류 발생:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Google Spreadsheet 생성 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
