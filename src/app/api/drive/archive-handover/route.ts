import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { getGoogleDriveClient } from '@/lib/server/googleAuth';
import { resolveOrCreateYearHandoverFolder } from '@/lib/server/driveDeptFolderHelper';
import { uploadHtmlAsPdfToDriveFolder, uploadPdfBufferToDriveFolder } from '@/lib/server/drivePdfUploadHelper';
import type { GoogleDriveYearFolders } from '@/lib/types';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import type { DocumentReference } from 'firebase-admin/firestore';
import { resolveStaffCaller, StaffAuthError } from '@/lib/server/staffRequestAuth';

// 결재 완료 상태(업무: VICE_PRINCIPAL_APPROVED/ARCHIVED, 비품: APPROVED)인 문서만 서버에서 Drive 메타를 기록한다.
const ARCHIVABLE_STATUSES = new Set(['VICE_PRINCIPAL_APPROVED', 'ARCHIVED', 'APPROVED']);
const HANDOVER_DOCS_COL = 'handover_documents';

/**
 * 결재 완료 문서의 기존 Drive 파일(휴지통 제외)이 있으면 반환한다. (재시도 시 중복 업로드 방지)
 */
async function findExistingArchivedFile(drive: any, existing: any) {
  const fileId = existing?.archivedDriveFileId;
  if (!fileId) return null;
  try {
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, webViewLink, trashed',
      supportsAllDrives: true,
    });
    if (res.data && !res.data.trashed) return res.data;
  } catch {
    // 삭제되었거나 접근 불가 → 새로 업로드
  }
  return null;
}

interface ArchiveHandoverRequestBody {
  docId: string;
  docData: {
    year?: number;
    primaryDuty?: string;
    authorName?: string;
    submittedAt?: string;
    vicePrincipalReviewedAt?: string;
  };
  htmlContent: string;
  /** 브라우저에서 A4 인쇄 레이아웃 그대로 렌더링한 PDF (base64). 있으면 Google Docs 변환 없이 그대로 저장 */
  pdfBase64?: string;
  targetYear?: string;
  rootFolderId?: string;
  existingYearFolders?: Partial<GoogleDriveYearFolders> | null;
}

function sanitizeFileSegment(raw: string, fallback: string, maxLen = 40): string {
  const cleaned = String(raw || '')
    .replace(/[\\/:*?"<>|\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  return cleaned || fallback;
}

export async function POST(req: NextRequest) {
  try {
    // 로그인한 교직원만 호출 가능 (학부모·학생·비로그인 요청 거부)
    let callerEmail = '';
    try {
      callerEmail = (await resolveStaffCaller(req.headers)).email;
    } catch (authErr) {
      if (authErr instanceof StaffAuthError) {
        return NextResponse.json({ success: false, error: authErr.message }, { status: authErr.status });
      }
      throw authErr;
    }

    const body: ArchiveHandoverRequestBody = await req.json();
    const { docId, docData, htmlContent } = body;

    if (!docId || !docData || !htmlContent) {
      return NextResponse.json(
        { success: false, error: 'docId, docData 및 htmlContent가 필요합니다.' },
        { status: 400 }
      );
    }

    const docYearNum = Number(docData.year) || new Date().getFullYear();
    const targetYear =
      (body.targetYear && /^\d{4}$/.test(body.targetYear.trim()) && body.targetYear.trim()) ||
      String(docYearNum + 1);
    const rootFolderId = body.rootFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null;

    const drive = getGoogleDriveClient();

    // 0. 대상 문서 확인: 실제로 존재하는 결재 완료 문서만 Drive에 저장한다.
    //    (임의 파일 업로드 차단. 서버가 직접 Drive 메타를 기록하므로 클라이언트가 응답 전에 끊어도 링크가 보존됨)
    const docRef: DocumentReference = getAdminDb().collection(HANDOVER_DOCS_COL).doc(String(docId));
    const snap = await docRef.get();
    const existingDoc: any = snap.exists ? snap.data() : null;
    if (!existingDoc) {
      return NextResponse.json({ success: false, error: '인수인계서를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (!ARCHIVABLE_STATUSES.has(existingDoc.status)) {
      return NextResponse.json(
        { success: false, error: '최종 결재가 완료된 인수인계서만 Google Drive에 저장할 수 있습니다.' },
        { status: 409 }
      );
    }
    console.info(`[archive-handover] ${callerEmail} → ${docId} Drive 저장 요청`);

    const alreadyArchived = await findExistingArchivedFile(drive, existingDoc);
    if (alreadyArchived) {
      const folderId = existingDoc.archivedDriveFolderId || '';
      return NextResponse.json({
        success: true,
        targetYear,
        alreadyArchived: true,
        message: '이미 Google Drive에 저장된 결재완료 인수인계서가 있습니다.',
        file: {
          id: alreadyArchived.id,
          name: alreadyArchived.name,
          webViewLink: alreadyArchived.webViewLink,
          folderId,
          folderUrl:
            existingDoc.archivedDriveFolderUrl ||
            (folderId ? `https://drive.google.com/drive/folders/${folderId}` : ''),
        },
        yearFolders: null,
      });
    }

    // 1. 다음 학년도({targetYear}학년도) 루트 폴더 및 하위 '인수인계' 폴더 자동 탐색·생성
    const { targetFolderId, targetFolderUrl, yearFolders } = await resolveOrCreateYearHandoverFolder({
      drive,
      targetYear,
      rootFolderId,
      existingYearFolders: body.existingYearFolders,
      logPrefix: '[archive-handover]',
    });

    if (!targetFolderId) {
      return NextResponse.json(
        {
          success: false,
          error: `Google Drive에 ${targetYear}학년도 인수인계 폴더를 생성할 수 없습니다. 중앙 저장소 루트 폴더 ID 및 권한을 확인하세요.`,
        },
        { status: 404 }
      );
    }

    // 2. 결재완료 인수인계서 HTML 스냅샷 -> PDF 변환 후 {targetYear}학년도/인수인계 폴더에 업로드
    const safeDuty = sanitizeFileSegment(docData.primaryDuty || '업무인수인계', '업무인수인계', 45);
    const safeAuthor = sanitizeFileSegment(docData.authorName || '작성자', '작성자', 20);
    const approvedDateRaw = docData.vicePrincipalReviewedAt ? new Date(docData.vicePrincipalReviewedAt) : new Date();
    const dateSlug = Number.isNaN(approvedDateRaw.getTime())
      ? format(new Date(), 'yyyy-MM-dd')
      : format(approvedDateRaw, 'yyyy-MM-dd');

    const baseName = `[결재완료]_${docYearNum}학년도_${safeDuty}_${safeAuthor}_${dateSlug}`;
    // 브라우저 렌더링 PDF가 있으면 그대로 저장(레이아웃 보존), 없거나 손상되었으면 기존 Docs 변환 방식으로 폴백
    let uploaded = null as Awaited<ReturnType<typeof uploadHtmlAsPdfToDriveFolder>> | null;
    if (body.pdfBase64) {
      try {
        uploaded = await uploadPdfBufferToDriveFolder({
          drive,
          targetFolderId,
          pdfBuffer: Buffer.from(body.pdfBase64, 'base64'),
          pdfFileName: `${baseName}.pdf`,
        });
      } catch (pdfErr) {
        console.warn('[archive-handover] 렌더링 PDF 저장 실패, Docs 변환으로 대체:', pdfErr);
      }
    }
    if (!uploaded) {
      uploaded = await uploadHtmlAsPdfToDriveFolder({
        drive,
        targetFolderId,
        htmlContent,
        pdfFileName: `${baseName}.pdf`,
        htmlFallbackFileName: `${baseName}.html`,
        tempDocPrefix: `temp_handover_${docId}`,
      });
    }

    const folderUrl = targetFolderUrl || `https://drive.google.com/drive/folders/${targetFolderId}`;
    await docRef
      .update({
        archivedTargetYear: Number(targetYear),
        archivedDriveFileId: uploaded.id,
        archivedDriveFileUrl: uploaded.webViewLink || '',
        archivedDriveFolderId: targetFolderId,
        archivedDriveFolderUrl: folderUrl,
        updatedAt: new Date().toISOString(),
      })
      .catch((err: any) => console.warn('[archive-handover] Drive 메타 저장 경고:', err));

    return NextResponse.json({
      success: true,
      targetYear,
      message: `최종 승인된 인수인계서가 ${targetYear}학년도 인수인계 폴더에 저장되었습니다.`,
      file: {
        id: uploaded.id,
        name: uploaded.name,
        webViewLink: uploaded.webViewLink,
        folderId: targetFolderId,
        folderUrl,
      },
      yearFolders,
    });
  } catch (error: any) {
    console.error('[archive-handover] 인수인계서 Drive 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '인수인계서 Google Drive 저장 오류' },
      { status: 500 }
    );
  }
}
