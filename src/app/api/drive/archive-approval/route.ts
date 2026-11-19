import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveClient } from '@/lib/server/googleAuth';
import { resolveDeptArchiveFolder } from '@/lib/server/driveDeptFolderHelper';
import { formatOfficialDocumentHtml } from '@/lib/documentFormatter';
import { Readable } from 'stream';
import { format } from 'date-fns';
import { discardDriveTempFile } from '@/lib/server/driveTempCleanup';
import { denyIfNotStaff } from '@/lib/server/staffRequestAuth';

interface ArchiveApprovalRequestBody {
  docId: string;
  docData: any;
  academicYear?: string;
  rootFolderId?: string;
  targetFolderId?: string;
  deptName?: string;
  folderName?: string;
  docConfig?: {
    slogan?: string;
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
    homepage?: string;
    headerImage?: string;
  };
}

function escapeHtml(val: any): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseSafeDate(raw: any): Date {
  if (!raw) return new Date();
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? new Date() : raw;
  if (typeof raw?.seconds === 'number') return new Date(raw.seconds * 1000);
  if (typeof raw?._seconds === 'number') return new Date(raw._seconds * 1000);
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? new Date() : dt;
}

function isRenderableImageUrl(src?: string): boolean {
  if (!src || typeof src !== 'string') return false;
  const s = src.trim();
  return s.startsWith('data:image/') || s.startsWith('https://') || s.startsWith('http://');
}

export async function POST(req: NextRequest) {
  // 로그인한 교직원만 호출 가능
  const denied = await denyIfNotStaff(req, '[archive-approval]');
  if (denied) return denied;

  try {
    const body: ArchiveApprovalRequestBody = await req.json();
    const { docId, docData } = body;

    if (!docId || !docData) {
      return NextResponse.json(
        { success: false, error: 'docId 및 docData가 필요합니다.' },
        { status: 400 }
      );
    }

    const drive = getGoogleDriveClient();

    const approvalDate = parseSafeDate(docData.completedAt || docData.createdAt);
    const currentYear = approvalDate.getFullYear();
    const currentMonth = approvalDate.getMonth() + 1;
    const academicYear =
      body.academicYear || String(currentMonth >= 3 ? currentYear : currentYear - 1);
    const rootFolderId = body.rootFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    const deptName =
      (body.deptName || docData.driveTargetDeptName || '교무기획부').trim();
    const folderName =
      (body.folderName || docData.driveTargetTaskName || '01_결재완료문서').trim();
    const requestedTargetFolderId =
      body.targetFolderId || docData.driveTargetFolderId || undefined;

    // 1. 편철 대상 Google Drive 폴더 확인 / 생성
    const { folderId: targetFolderId, folderUrl: targetFolderUrl } =
      await resolveDeptArchiveFolder({
        drive,
        academicYear,
        deptName,
        folderName,
        legacyNames: [folderName],
        requestedTargetFolderId,
        rootFolderId,
        allowGlobalDirectCreate: true,
        logPrefix: '[archive-approval]',
      });

    if (!targetFolderId) {
      return NextResponse.json(
        {
          success: false,
          error: `Google Drive에서 저장 문서함(${deptName} > ${folderName})을 찾거나 생성할 수 없습니다.`,
        },
        { status: 404 }
      );
    }

    // 2. 공식 A4 결재완료 문서 HTML 생성 (Google Docs 변환 호환 Table 레이아웃)
    const cfg = body.docConfig || {};
    const footerInfo = docData.footerInfo || {};
    const slogan =
      cfg.slogan || '글로네이컬(GloNaCal) 미래 인재를 키우는 행복한 학교';
    const headerImage = docData.headerImage || cfg.headerImage || '';
    const isFamily = docData.category === 'family';
    const docNo = String(docData.docNo || docId).trim();
    const title = String(docData.title || '제목 없음').trim();
    const recipientText =
      docData.docType === 'external'
        ? docData.receiverInfo?.name || '대외공문 수신처'
        : '내부결재';
    const publishStatus = docData.publishStatus || '공개';

    const address =
      footerInfo.address ||
      cfg.address ||
      '21 Tan Phu Street, Tan Phu Ward, Dist.7 HCMC';
    const phone = footerInfo.phone || cfg.phone || '028-5417-9021';
    const fax = footerInfo.fax || cfg.fax || '028-5417-9022';
    const schoolEmail = footerInfo.email || cfg.email || 'hcmcks@hanmail.net';
    const homepage = footerInfo.homepage || cfg.homepage || 'http://kshcm.net';

    const approvers: any[] = Array.isArray(docData.approvers) ? docData.approvers : [];
    const mainApprovers = approvers.filter(a => a?.role !== '협조');
    const assistantApprover = approvers.find(a => a?.role === '협조');

    const isPrincipalRole = (role?: string) => {
      if (!role) return false;
      const r = role.trim();
      return r === '교장' || r === '학교장' || r === '원장' || r === '대표';
    };

    const getTypeText = (type?: string, role?: string) => {
      if (isPrincipalRole(role)) return '';
      if (type === 'final') return '전결';
      if (type === 'proxy') return '대결';
      return '';
    };

    const approvalCells: string[] = [
      `
        <td style="border: none; padding: 6px 8px 6px 0; vertical-align: middle; text-align: left;">
          <span style="font-weight: bold; font-size: 10.5pt;">${escapeHtml(docData.requesterRole || '기안자')}</span>
          <span style="margin-left: 6px; font-weight: 600; font-size: 10.5pt;">${escapeHtml(docData.requesterName || '')}</span>
          ${
            isRenderableImageUrl(docData.requesterSignature)
              ? `<img src="${escapeHtml(docData.requesterSignature)}" style="height: 28px; max-width: 48px; vertical-align: middle; margin-left: 4px;" alt="서명" />`
              : `<span style="font-size: 9pt; color: #334155;">(인)</span>`
          }
        </td>
      `,
      ...mainApprovers.map(ap => {
        const typeText = ap.type !== 'normal' ? getTypeText(ap.type, ap.role) : '';
        const nameText = ap.approverName || ap.name || '';
        const statusDate = ap.approvedAt ? String(ap.approvedAt).slice(0, 10) : '';
        return `
          <td style="border: none; padding: 6px 8px; vertical-align: middle; text-align: left;">
            <span style="font-weight: bold; font-size: 10.5pt;">${escapeHtml(ap.role || '')}</span>
            ${
              typeText
                ? `<span style="font-size: 8.5pt; color: #2471b2; font-weight: bold; margin-left: 3px;">(${escapeHtml(typeText)})</span>`
                : ''
            }
            <span style="margin-left: 6px; font-weight: 600; font-size: 10.5pt;">${escapeHtml(nameText)}</span>
            ${
              ap.status === 'approved' && isRenderableImageUrl(ap.signature)
                ? `<img src="${escapeHtml(ap.signature)}" style="height: 28px; max-width: 48px; vertical-align: middle; margin-left: 4px;" alt="서명" />`
                : ap.status === 'approved'
                  ? `<span style="font-size: 8.5pt; color: #16a34a; font-weight: bold; margin-left: 3px;">[승인${statusDate ? ` ${escapeHtml(statusDate)}` : ''}]</span>`
                  : ''
            }
          </td>
        `;
      }),
    ];

    const assistantHtml = assistantApprover
      ? `
        <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 4px; font-size: 10pt;">
          <strong>${escapeHtml(assistantApprover.role || '협조')}</strong>
          <span style="margin-left: 8px; font-weight: 600;">${escapeHtml(assistantApprover.approverName || assistantApprover.name || '')}</span>
          ${
            assistantApprover.status === 'approved' && isRenderableImageUrl(assistantApprover.signature)
              ? `<img src="${escapeHtml(assistantApprover.signature)}" style="height: 26px; max-width: 44px; vertical-align: middle; margin-left: 4px;" alt="협조서명" />`
              : assistantApprover.status === 'approved'
                ? `<span style="font-size: 8.5pt; color: #16a34a; font-weight: bold; margin-left: 4px;">[승인]</span>`
                : ''
          }
        </div>
      `
      : '';

    const attachments: any[] = Array.isArray(docData.attachments) ? docData.attachments : [];
    const attachmentsNoteHtml =
      attachments.length > 0
        ? `
          <div style="margin-top: 14px; padding: 8px 10px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 9.5pt;">
            <strong>첨부파일 (${attachments.length}건):</strong>
            ${attachments.map((att, idx) => `${idx + 1}. ${escapeHtml(att.name || '첨부문서')}`).join(' &nbsp;|&nbsp; ')}
          </div>
        `
        : '';

    const formattedBodyHtml = formatOfficialDocumentHtml(docData.content || '');
    const approvalDateFormatted = format(approvalDate, 'yyyy. MM. dd.');

    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(docNo)}_${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 18mm 15mm 18mm; }
    body {
      font-family: 'Nanum Myeongjo', 'Batang', 'Malgun Gothic', serif;
      margin: 0;
      padding: 0;
      color: #111827;
      background-color: #ffffff;
      font-size: 11.5pt;
      line-height: 1.7;
    }
    .doc-body p { margin: 0 0 6px 0; }
    .doc-body table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    .doc-body th, .doc-body td { border: 1px solid #334155; padding: 5px 8px; }
    .doc-body table.attachment-table th, .doc-body table.attachment-table td { border: none !important; }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 18px;">
    <p style="font-size: 10.5pt; color: #6b7280; margin: 0 0 10px 0;">${escapeHtml(slogan)}</p>
    ${
      isFamily
        ? `<h1 style="font-size: 24pt; font-weight: 800; letter-spacing: 0.3em; border: 2px solid #000; display: inline-block; padding: 6px 24px; margin: 0;">가 정 통 신 문</h1>`
        : isRenderableImageUrl(headerImage)
          ? `<img src="${escapeHtml(headerImage)}" alt="Header" style="height: 56px; margin: 0 auto 6px auto;" />`
          : `<h1 style="font-size: 20pt; font-weight: 800; margin: 0 0 6px 0;">호치민시한국국제학교</h1>`
    }
  </div>

  ${
    !isFamily
      ? `
    <div style="margin-bottom: 14px; font-size: 11.5pt; line-height: 1.6;">
      <table style="width: 100%; border-collapse: collapse; border: none;">
        <tr>
          <td style="width: 52px; font-weight: bold; border: none; padding: 2px 0; vertical-align: top;">수신</td>
          <td style="border: none; padding: 2px 0;">${escapeHtml(recipientText)}</td>
        </tr>
        <tr>
          <td colspan="2" style="border: none; padding: 2px 0;">(경유)</td>
        </tr>
        <tr>
          <td style="width: 52px; font-weight: bold; border: none; padding: 2px 0; vertical-align: top;">제목</td>
          <td style="border: none; padding: 2px 0; font-weight: 600;">${escapeHtml(title)}</td>
        </tr>
      </table>
      <div style="border-bottom: 2px solid #000000; margin-top: 6px;"></div>
    </div>
  `
      : ''
  }

  <div class="doc-body" style="min-height: 140mm; margin-bottom: 18px;">
    ${formattedBodyHtml}
    ${attachmentsNoteHtml}
  </div>

  ${
    docData.docType === 'external'
      ? `<div style="text-align: center; margin: 18px 0 16px 0;"><h2 style="font-size: 20pt; font-weight: 900; letter-spacing: 0.35em; margin: 0;">호치민시한국국제학교장</h2></div>`
      : ''
  }

  <div style="border-top: 2px solid #000000; padding-top: 8px; margin-top: 16px;">
    <table style="width: 100%; border-collapse: collapse; border: none;">
      <tr>
        ${approvalCells.join('')}
      </tr>
    </table>
    ${assistantHtml}
  </div>

  <div style="border-top: 1px solid #cbd5e1; margin-top: 10px; padding-top: 8px; font-size: 9.5pt; color: #374151; line-height: 1.55;">
    <p style="margin: 0 0 3px 0;">
      <strong>시행</strong> ${escapeHtml(docNo)} (${escapeHtml(approvalDateFormatted)})
      ${!isFamily ? `&nbsp;&nbsp;&nbsp;&nbsp; <strong>접수</strong> ( &nbsp;&nbsp;&nbsp;&nbsp; )` : ''}
    </p>
    <p style="margin: 0 0 3px 0;"><strong>우</strong> ${escapeHtml(address)}</p>
    <table style="width: 100%; border-collapse: collapse; border: none; font-size: 9.5pt; color: #374151;">
      <tr>
        <td style="border: none; padding: 0;"><strong>전화</strong> ${escapeHtml(phone)} / <strong>전송</strong> ${escapeHtml(fax)} / ${escapeHtml(schoolEmail)}</td>
        <td style="border: none; padding: 0; text-align: right;">${escapeHtml(homepage)} / <strong>${escapeHtml(publishStatus)}</strong></td>
      </tr>
    </table>
  </div>
</body>
</html>`;

    const safeDocNo = (docNo || '결재완료').replace(/[\\/:*?"<>|]/g, '_');
    const safeTitle = title
      .replace(/[\\/:*?"<>|\r\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 55);
    const dateSlug = format(approvalDate, 'yyyy-MM-dd');
    const pdfFileName = `[결재완료]_${safeDocNo}_${safeTitle}_${dateSlug}.pdf`;

    let finalFileId = '';
    let finalFileName = pdfFileName;
    let finalViewLink = '';

    // 3. Google Docs 변환 -> PDF 내보내기 -> 선택 폴더에 저장 (실패 시 HTML 직접 저장)
    let tempId: string | null = null;
    try {
      const tempDoc = await drive.files.create({
        requestBody: {
          name: `temp_approval_${docId}_${Date.now()}`,
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
      console.warn('[archive-approval] PDF 변환 실패, HTML 파일 직접 저장으로 대체:', convertErr);
      const altFileName = `[결재완료]_${safeDocNo}_${safeTitle}_${dateSlug}.html`;
      const uploadedHtml = await drive.files.create({
        requestBody: {
          name: altFileName,
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
      finalFileName = uploadedHtml.data.name || altFileName;
      finalViewLink =
        uploadedHtml.data.webViewLink || `https://drive.google.com/file/d/${finalFileId}/view`;
    } finally {
      if (tempId) {
        try {
          await discardDriveTempFile(drive, tempId, '[archive-approval]');
        } catch {}
      }
    }

    if (finalFileId) {
      try {
        const workspaceDomain = process.env.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN || 'kshcm.net';
        await drive.permissions.create({
          fileId: finalFileId,
          requestBody: {
            role: 'writer',
            type: 'domain',
            domain: workspaceDomain,
          },
          supportsAllDrives: true,
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: '결재 완료 문서가 선택한 저장 문서함에 아카이빙되었습니다.',
      file: {
        id: finalFileId,
        name: finalFileName,
        webViewLink: finalViewLink,
        folderId: targetFolderId,
        folderUrl: targetFolderUrl || `https://drive.google.com/drive/folders/${targetFolderId}`,
      },
    });
  } catch (error: any) {
    console.error('[archive-approval] 아카이빙 에러:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Google Drive 결재완료문서 저장 오류' },
      { status: 500 }
    );
  }
}
