import { getGoogleDriveClient } from '@/lib/server/googleAuth';
import { Readable } from 'stream';
import { discardDriveTempFile } from '@/lib/server/driveTempCleanup';

interface UploadHtmlAsPdfParams {
  drive: ReturnType<typeof getGoogleDriveClient>;
  targetFolderId: string;
  htmlContent: string;
  pdfFileName: string;
  htmlFallbackFileName: string;
  tempDocPrefix?: string;
  shareDomain?: string;
}

export interface UploadedDriveFileResult {
  id: string;
  name: string;
  webViewLink: string;
}

/**
 * HTML 문서를 Google Docs 임시 파일로 변환해 A4 PDF로 내보내고 지정 폴더에 영구 저장한다.
 * PDF 변환 실패 시 HTML 파일 직접 업로드로 안전하게 폴백하며, 도메인 편집 권한을 자동 부여한다.
 */
export async function uploadHtmlAsPdfToDriveFolder({
  drive,
  targetFolderId,
  htmlContent,
  pdfFileName,
  htmlFallbackFileName,
  tempDocPrefix = 'temp_doc',
  shareDomain = process.env.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN || 'kshcm.net',
}: UploadHtmlAsPdfParams): Promise<UploadedDriveFileResult> {
  let finalFileId = '';
  let finalFileName = pdfFileName;
  let finalViewLink = '';
  let tempId: string | null = null;

  try {
    const tempDoc = await drive.files.create({
      requestBody: {
        name: `${tempDocPrefix}_${Date.now()}`,
        mimeType: 'application/vnd.google-apps.document',
        parents: [targetFolderId],
      },
      media: {
        mimeType: 'text/html',
        body: htmlContent,
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    tempId = tempDoc.data.id || null;
    if (!tempId) {
      throw new Error('임시 Google Docs 파일 생성 실패');
    }

    const pdfExport = await drive.files.export(
      {
        fileId: tempId,
        mimeType: 'application/pdf',
      },
      { responseType: 'arraybuffer' }
    );

    const pdfBuffer = Buffer.from(pdfExport.data as ArrayBuffer);

    const uploadedFile = await drive.files.create({
      requestBody: {
        name: pdfFileName,
        parents: [targetFolderId],
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(pdfBuffer),
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });

    finalFileId = uploadedFile.data.id || '';
    finalFileName = uploadedFile.data.name || pdfFileName;
    finalViewLink =
      uploadedFile.data.webViewLink || `https://drive.google.com/file/d/${finalFileId}/view`;
  } catch (convertErr) {
    console.warn('[drivePdfUploadHelper] PDF 변환 실패, HTML 직접 저장으로 대체:', convertErr);
    const uploadedHtml = await drive.files.create({
      requestBody: {
        name: htmlFallbackFileName,
        parents: [targetFolderId],
        mimeType: 'text/html',
      },
      media: {
        mimeType: 'text/html',
        body: Readable.from(Buffer.from(htmlContent, 'utf-8')),
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });
    finalFileId = uploadedHtml.data.id || '';
    finalFileName = uploadedHtml.data.name || htmlFallbackFileName;
    finalViewLink =
      uploadedHtml.data.webViewLink || `https://drive.google.com/file/d/${finalFileId}/view`;
  } finally {
    if (tempId) {
      try {
        await discardDriveTempFile(drive, tempId, '[drivePdfUploadHelper]');
      } catch {
        // ignore temp cleanup errors
      }
    }
  }

  if (finalFileId && shareDomain) {
    try {
      await drive.permissions.create({
        fileId: finalFileId,
        requestBody: {
          role: 'writer',
          type: 'domain',
          domain: shareDomain,
        },
        supportsAllDrives: true,
      });
    } catch {
      // ignore permission warnings (e.g. consumer Drive root)
    }
  }

  return {
    id: finalFileId,
    name: finalFileName,
    webViewLink: finalViewLink,
  };
}

/**
 * 브라우저에서 이미 렌더링된 PDF(base64)를 변환 없이 그대로 지정 폴더에 저장한다.
 * (Google Docs 변환을 거치지 않으므로 화면의 A4 인쇄 미리보기와 동일한 레이아웃이 보존된다)
 */
export async function uploadPdfBufferToDriveFolder({
  drive,
  targetFolderId,
  pdfBuffer,
  pdfFileName,
  shareDomain = process.env.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN || 'kshcm.net',
}: {
  drive: ReturnType<typeof getGoogleDriveClient>;
  targetFolderId: string;
  pdfBuffer: Buffer;
  pdfFileName: string;
  shareDomain?: string;
}): Promise<UploadedDriveFileResult> {
  if (pdfBuffer.length < 5 || pdfBuffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error('올바른 PDF 데이터가 아닙니다.');
  }

  const uploaded = await drive.files.create({
    requestBody: {
      name: pdfFileName,
      parents: [targetFolderId],
      mimeType: 'application/pdf',
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(pdfBuffer),
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });

  const id = uploaded.data.id || '';
  if (id && shareDomain) {
    try {
      await drive.permissions.create({
        fileId: id,
        requestBody: { role: 'writer', type: 'domain', domain: shareDomain },
        supportsAllDrives: true,
      });
    } catch {
      // ignore permission warnings
    }
  }

  return {
    id,
    name: uploaded.data.name || pdfFileName,
    webViewLink: uploaded.data.webViewLink || `https://drive.google.com/file/d/${id}/view`,
  };
}
