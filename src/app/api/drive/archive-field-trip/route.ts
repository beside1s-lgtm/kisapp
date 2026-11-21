import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveClient } from '@/lib/server/googleAuth';
import { resolveDeptArchiveFolder } from '@/lib/server/driveDeptFolderHelper';
import { SPECIAL_FOLDER_DEFS } from '@/lib/drive/deptFolderMapping';
import { Readable } from 'stream';
import { format } from 'date-fns';
import { discardDriveTempFile } from '@/lib/server/driveTempCleanup';
import { denyIfNotStaff } from '@/lib/server/staffRequestAuth';
import { serverAcademicYearForDate } from '@/lib/server/systemAcademicYear';

interface ArchiveFieldTripRequestBody {
  docId: string;
  docData: any;
  academicYear?: string;
  rootFolderId?: string;
  targetFolderId?: string;
  deptName?: string;
}

export async function POST(req: NextRequest) {
  // 로그인한 교직원만 호출 가능
  const denied = await denyIfNotStaff(req, '[archive-field-trip]');
  if (denied) return denied;

  try {
    const body: ArchiveFieldTripRequestBody = await req.json();
    const { docId, docData } = body;

    if (!docId || !docData) {
      return NextResponse.json(
        { success: false, error: 'docId 및 docData가 필요합니다.' },
        { status: 400 }
      );
    }

    const pData = docData.parentFormData || {};
    const isFieldTrip = pData.type === 'field-trip' || pData.type === 'fieldTrip';
    if (!isFieldTrip) {
      return NextResponse.json(
        { success: false, error: '체험학습 문서만 체험학습 폴더에 아카이빙할 수 있습니다.' },
        { status: 400 }
      );
    }

    const drive = getGoogleDriveClient();

    // 1. 대상 폴더 (부서 하위 체험학습신청서(완료)) 확인
    // 학년도: 시스템 설정(학사 일정 관리)에서 적용한 학년도 기준
    const academicYear = body.academicYear || (await serverAcademicYearForDate(new Date()));
    const rootFolderId = body.rootFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const def = SPECIAL_FOLDER_DEFS.fieldTripDone;

    const { folderId: targetFolderId } = await resolveDeptArchiveFolder({
      drive,
      academicYear,
      deptName: body.deptName || def.defaultDept,
      folderName: def.folderName,
      legacyNames: def.legacyNames,
      requestedTargetFolderId: body.targetFolderId,
      rootFolderId,
      logPrefix: '[archive-field-trip]',
    });

    if (!targetFolderId) {
      return NextResponse.json(
        { success: false, error: `Google Drive에서 ${def.defaultDept} > ${def.folderName} 폴더를 찾을 수 없습니다.` },
        { status: 404 }
      );
    }

    // 2. 체험학습 문서 데이터 파싱
    const rawGc = String(pData.gradeClassNumber || docData.gradeClass || '').trim();
    const parts = rawGc.replace(/[^0-9-]/g, '-').split('-').filter(Boolean);
    const grade = pData.studentGrade || parts[0] || '1';
    const studentClass = parts[1] || '1';
    const number = parts[2] || '';
    const studentName = pData.studentName || docData.requesterName || '학생';
    const docNo = docData.docNo || 'NO-DOC';
    const startDate = pData.tripPeriod?.startDate || '';
    const endDate = pData.tripPeriod?.endDate || '';
    const totalDays = pData.tripPeriod?.totalDays || 1;
    const destination = pData.destination || '-';
    const destinationDetail = pData.destinationDetail || '';
    const companion = pData.companion || '부모';
    const emergencyContact = pData.emergencyContact || '-';
    const detailedPlan = pData.detailedPlan || '-';
    const parentName = pData.parentName || '학부모';
    const submitDateStr = pData.submitDate || docData.createdAt || format(new Date(), 'yyyy-MM-dd');

    // 결재선 테이블 생성
    const approvers = Array.isArray(docData.approvers) ? docData.approvers : [];
    const approverSlots = ['담임', '부장', '교감', '교장'];
    const approverTds = approverSlots.map(slot => {
      const ap = approvers.find((a: any) => (a.role || '').includes(slot));
      return `
        <td style="width: 55px; border: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px;">
          <div style="font-size: 8pt; font-weight: bold; background-color: #f1f5f9; border-bottom: 1px solid #000; padding: 2px 0;">${slot}</div>
          <div style="font-size: 8.5pt; font-weight: bold; min-height: 28px; display: flex; align-items: center; justify-content: center; color: #1e3a8a;">
            ${ap ? (ap.name || '승인') : ''}
          </div>
          <div style="font-size: 7pt; color: #64748b;">${ap?.approvedAt ? String(ap.approvedAt).slice(0, 10) : ''}</div>
        </td>
      `;
    }).join('');

    // 결과보고서 유무 확인
    const hasReport = Boolean(
      pData.reportSubmitted ||
      docData.reportSubmitted ||
      pData.reportContent ||
      docData.reportContent
    );
    let reportContent = pData.reportContent || docData.reportContent || '';

    // 서식 1: 신청서 HTML
    const appPageHtml = `
      <div class="page" style="page-break-after: ${hasReport ? 'always' : 'avoid'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 8pt; color: #64748b; font-weight: bold;">[서식 1]</div>
            <h1 style="font-size: 16pt; font-weight: bold; margin: 4px 0 2px 0; letter-spacing: -0.5px;">
              「학교장허가 교외체험학습」 신청서
            </h1>
            <div style="font-size: 8pt; color: #dc2626; font-weight: bold;">(체험학습 실시 7일 전 제출)</div>
          </div>
          <div>
            <table style="border-collapse: collapse; border: 1.5px solid #000; font-size: 8pt;">
              <tr>
                <th rowspan="2" style="width: 20px; border: 1px solid #000; background: #f8fafc; font-weight: bold; padding: 4px; text-align: center;">결<br/>재</th>
                ${approverTds}
              </tr>
            </table>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 9pt; margin-bottom: 12px;">
          <tr>
            <th style="width: 90px; border: 1px solid #000; background: #f8fafc; padding: 6px; text-align: center; font-weight: bold;">학 생</th>
            <td style="border: 1px solid #000; padding: 6px;">
              ${grade}학년 ${studentClass}반 ${number ? number + '번' : ''} &nbsp; <b>${studentName}</b>
            </td>
            <th style="width: 90px; border: 1px solid #000; background: #f8fafc; padding: 6px; text-align: center; font-weight: bold;">신청 기간</th>
            <td style="border: 1px solid #000; padding: 6px;">
              ${startDate} ~ ${endDate} (총 <b>${totalDays}</b>일간)
            </td>
          </tr>
          <tr>
            <th style="border: 1px solid #000; background: #f8fafc; padding: 6px; text-align: center; font-weight: bold;">목 적 지</th>
            <td style="border: 1px solid #000; padding: 6px;">
              ${destination} ${destinationDetail ? `(${destinationDetail})` : ''}
            </td>
            <th style="border: 1px solid #000; background: #f8fafc; padding: 6px; text-align: center; font-weight: bold;">동행자 / 연락처</th>
            <td style="border: 1px solid #000; padding: 6px;">
              ${companion} / ${emergencyContact}
            </td>
          </tr>
          <tr>
            <th style="border: 1px solid #000; background: #f8fafc; padding: 6px; text-align: center; font-weight: bold;">체험학습 형태</th>
            <td colspan="3" style="border: 1px solid #000; padding: 6px;">
              ${pData.tripType || '가족문화체험'}
            </td>
          </tr>
          <tr>
            <th style="border: 1px solid #000; background: #f8fafc; padding: 10px 6px; text-align: center; font-weight: bold; vertical-align: top;">
              학습 계획<br/><span style="font-size: 7.5pt; color: #64748b; font-weight: normal;">(일정, 목적 등)</span>
            </th>
            <td colspan="3" style="border: 1px solid #000; padding: 12px; height: 180px; vertical-align: top; white-space: pre-wrap; font-size: 8.5pt; line-height: 1.6;">
              ${detailedPlan}
            </td>
          </tr>
        </table>

        <div style="text-align: center; font-size: 9.5pt; margin: 15px 0 8px 0; font-weight: bold;">
          위와 같이 「학교장허가 교외체험학습」을 신청합니다.
        </div>
        <div style="text-align: center; font-size: 9pt; margin-bottom: 12px; color: #475569;">
          ${submitDateStr}
        </div>
        <div style="display: flex; justify-content: flex-end; font-size: 9pt; padding-right: 30px; margin-bottom: 20px;">
          <span>신청인(보호자): <b>${parentName}</b> (서명)</span>
        </div>
        <div style="text-align: center; font-size: 13pt; font-weight: bold; letter-spacing: 2px;">
          호치민시한국국제학교장 귀하
        </div>
      </div>
    `;

    // 서식 2: 결과보고서 HTML (보고서 작성된 경우만)
    const reportPageHtml = hasReport ? `
      <div class="page" style="page-break-before: always;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 8pt; color: #64748b; font-weight: bold;">[서식 2]</div>
            <h1 style="font-size: 16pt; font-weight: bold; margin: 4px 0 2px 0; letter-spacing: -0.5px;">
              「학교장허가 교외체험학습」 결과보고서
            </h1>
            <div style="font-size: 8pt; color: #dc2626; font-weight: bold;">(체험학습 종료 후 7일 이내 제출)</div>
          </div>
          <div>
            <table style="border-collapse: collapse; border: 1.5px solid #000; font-size: 8pt;">
              <tr>
                <th rowspan="2" style="width: 20px; border: 1px solid #000; background: #f8fafc; font-weight: bold; padding: 4px; text-align: center;">결<br/>재</th>
                ${approverTds}
              </tr>
            </table>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 9pt; margin-bottom: 12px;">
          <tr>
            <th style="width: 90px; border: 1px solid #000; background: #f8fafc; padding: 6px; text-align: center; font-weight: bold;">학 생</th>
            <td style="border: 1px solid #000; padding: 6px;">
              ${grade}학년 ${studentClass}반 ${number ? number + '번' : ''} &nbsp; <b>${studentName}</b>
            </td>
            <th style="width: 90px; border: 1px solid #000; background: #f8fafc; padding: 6px; text-align: center; font-weight: bold;">실시 기간</th>
            <td style="border: 1px solid #000; padding: 6px;">
              ${startDate} ~ ${endDate} (총 <b>${totalDays}</b>일간)
            </td>
          </tr>
          <tr>
            <th style="border: 1px solid #000; background: #f8fafc; padding: 6px; text-align: center; font-weight: bold;">목 적 지</th>
            <td colspan="3" style="border: 1px solid #000; padding: 6px;">
              ${destination} ${destinationDetail ? `(${destinationDetail})` : ''}
            </td>
          </tr>
          <tr>
            <th style="border: 1px solid #000; background: #f8fafc; padding: 10px 6px; text-align: center; font-weight: bold; vertical-align: top;">
              체험학습<br/>결 과<br/><span style="font-size: 7.5pt; color: #64748b; font-weight: normal;">(배운 점, 소감 등)</span>
            </th>
            <td colspan="3" style="border: 1px solid #000; padding: 12px; height: 260px; vertical-align: top; white-space: pre-wrap; font-size: 8.5pt; line-height: 1.6;">
              ${reportContent || '(보고서 내용)'}
            </td>
          </tr>
        </table>

        <div style="text-align: center; font-size: 9.5pt; margin: 20px 0 8px 0; font-weight: bold;">
          위와 같이 「학교장허가 교외체험학습」 결과보고서를 제출합니다.
        </div>
        <div style="text-align: center; font-size: 9pt; margin-bottom: 15px; color: #475569;">
          ${submitDateStr}
        </div>
        <div style="display: flex; justify-content: flex-end; font-size: 9pt; padding-right: 30px; margin-bottom: 25px;">
          <span>제출인(학생): <b>${studentName}</b> &nbsp;&nbsp;&nbsp; 보호자: <b>${parentName}</b> (서명)</span>
        </div>
        <div style="text-align: center; font-size: 13pt; font-weight: bold; letter-spacing: 2px;">
          호치민시한국국제학교장 귀하
        </div>
      </div>
    ` : '';

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <title>[체험학습]_${grade}학년${studentClass}반_${studentName}_${docNo}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Malgun Gothic', '맑은 고딕', sans-serif;
            color: #000;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            width: 100%;
            min-height: 250mm;
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        ${appPageHtml}
        ${reportPageHtml}
      </body>
      </html>
    `;

    // 3. Google Docs -> PDF 변환 및 폴더 저장
    const fileName = `[체험학습]_${grade}학년${studentClass}반_${studentName}_${startDate}_${docNo}.pdf`;
    let finalFileId = '';
    let finalViewLink = '';

    try {
      const tempDoc = await drive.files.create({
        requestBody: {
          name: `temp_ft_${docNo}`,
          mimeType: 'application/vnd.google-apps.document',
          parents: [targetFolderId],
        },
        media: {
          mimeType: 'text/html',
          body: fullHtml,
        },
        fields: 'id',
        supportsAllDrives: true,
      });

      const tempId = tempDoc.data.id!;

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
          name: fileName,
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
      finalViewLink = uploadedFile.data.webViewLink || `https://drive.google.com/file/d/${finalFileId}/view`;

      try {
        await discardDriveTempFile(drive, tempId, '[archive-field-trip]');
      } catch {}
    } catch (convertErr: any) {
      console.warn('[archive-field-trip] PDF 변환 실패, HTML 원본 직접 저장 폴백:', convertErr);
      const altFileName = `[체험학습]_${grade}학년${studentClass}반_${studentName}_${startDate}_${docNo}.html`;
      const htmlBuffer = Buffer.from(fullHtml, 'utf-8');
      const uploadedHtml = await drive.files.create({
        requestBody: {
          name: altFileName,
          parents: [targetFolderId],
          mimeType: 'text/html',
        },
        media: {
          mimeType: 'text/html',
          body: Readable.from(htmlBuffer),
        },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      });

      finalFileId = uploadedHtml.data.id || '';
      finalViewLink = uploadedHtml.data.webViewLink || `https://drive.google.com/file/d/${finalFileId}/view`;
    }

    return NextResponse.json({
      success: true,
      message: `${fileName} 파일이 04_체험학습신청서(완료) 폴더에 아카이빙되었습니다.`,
      file: {
        id: finalFileId,
        name: fileName,
        webViewLink: finalViewLink,
      },
    });
  } catch (error: any) {
    console.error('[archive-field-trip] 처리 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '체험학습 Google Drive 아카이빙 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
