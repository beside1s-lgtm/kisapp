import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveClient } from '@/lib/server/googleAuth';
import { Readable } from 'stream';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const folderId = formData.get('folderId') as string;
    const file = formData.get('file') as File | null;

    if (!folderId) {
      return NextResponse.json(
        { success: false, error: 'Google Drive folderId가 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: '업로드할 파일이 없습니다.' },
        { status: 400 }
      );
    }

    const drive = getGoogleDriveClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);

    // Google Drive 파일 생성 및 업로드
    const res = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [folderId],
        mimeType: file.type || 'application/octet-stream'
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: stream
      },
      fields: 'id, name, mimeType, webViewLink, webContentLink, size',
      supportsAllDrives: true
    });

    const fileId = res.data.id;
    if (!fileId) {
      throw new Error('Google Drive에 파일이 생성되었으나 fileId를 받지 못했습니다.');
    }

    // 도메인 권한 부여 시도 (@kshcm.net)
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
    } catch (permErr) {
      console.warn('[upload-file] 도메인 권한 부여 경고 (파일 자체는 업로드됨):', permErr);
    }

    return NextResponse.json({
      success: true,
      file: {
        id: fileId,
        name: res.data.name || file.name,
        mimeType: res.data.mimeType,
        webViewLink: res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
        webContentLink: res.data.webContentLink,
        size: res.data.size ? parseInt(res.data.size, 10) : buffer.length
      }
    });
  } catch (error: any) {
    console.error('[upload-file] 업로드 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
