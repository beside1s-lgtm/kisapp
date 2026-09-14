import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveClient } from '@/lib/server/googleAuth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json(
        { success: false, error: 'Google Drive folderId가 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    const drive = getGoogleDriveClient();

    // 해당 폴더 내의 파일/하위폴더 목록 조회 (삭제된 항목 제외, 최근 수정순 정렬)
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, webContentLink, iconLink, size, modifiedTime, thumbnailLink)',
      orderBy: 'folder desc, modifiedTime desc',
      pageSize: 50,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const files = (res.data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      webContentLink: f.webContentLink,
      iconLink: f.iconLink,
      thumbnailLink: f.thumbnailLink,
      size: f.size ? parseInt(f.size, 10) : 0,
      modifiedTime: f.modifiedTime,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder'
    }));

    return NextResponse.json({
      success: true,
      folderId,
      files
    });
  } catch (error: any) {
    console.error('[list-files] 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '파일 목록을 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
