import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveClient, getGoogleDocsClient } from '@/lib/server/googleAuth';
import { resolveDeptArchiveFolder } from '@/lib/server/driveDeptFolderHelper';
import { SPECIAL_FOLDER_DEFS } from '@/lib/drive/deptFolderMapping';
import { Readable } from 'stream';
import type { SchoolFacility, MonthlyInspectionRecord } from '@/lib/safety/types';
import { SAFETY_INSPECTION_ITEMS } from '@/lib/safety/types';
import { getTeacherStampSignature, isActualSignature } from '@/lib/safety/stampHelper';
import { discardDriveTempFile } from '@/lib/server/driveTempCleanup';
import { denyIfNotStaff } from '@/lib/server/staffRequestAuth';
import { serverAcademicYearForDate } from '@/lib/server/systemAcademicYear';

interface ArchiveSafetyInspectionRequest {
  yearMonth: string; // 예: "2026-11"
  academicYear?: string;
  rootFolderId?: string;
  targetFolderId?: string;
  deptName?: string;
  facilities: SchoolFacility[];
  records: MonthlyInspectionRecord[];
  teacherSignatures?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  // 로그인한 교직원만 호출 가능
  const denied = await denyIfNotStaff(req, '[archive-safety-inspection]');
  if (denied) return denied;

  try {
    const body: ArchiveSafetyInspectionRequest = await req.json();
    const { yearMonth, facilities, records, teacherSignatures = {} } = body;

    if (!yearMonth || !facilities || !Array.isArray(facilities)) {
      return NextResponse.json(
        { success: false, error: 'yearMonth 및 facilities 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    const drive = getGoogleDriveClient();

    // 1. 학년도 및 부서 하위 대상 폴더(안전점검표) 탐색 및 생성
    const monthDisplay = parseInt(yearMonth.split('-')[1] || '11', 10);
    const yearDisplay = yearMonth.split('-')[0] || '2026';
    // 학년도: 점검 월(1일 기준)이 현재 시스템 학년도 시작 이후면 시스템 학년도
    const academicYear =
      body.academicYear ||
      (await serverAcademicYearForDate(`${yearDisplay}-${String(monthDisplay).padStart(2, '0')}-01`));
    const rootFolderId = body.rootFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const def = SPECIAL_FOLDER_DEFS.safetyInspection;

    const { folderId: targetFolderId, folderUrl: targetFolderUrl } = await resolveDeptArchiveFolder({
      drive,
      academicYear,
      deptName: body.deptName || def.defaultDept,
      folderName: def.folderName,
      legacyNames: def.legacyNames,
      requestedTargetFolderId: body.targetFolderId,
      rootFolderId,
      allowGlobalDirectCreate: true,
      logPrefix: '[archive-safety-inspection]',
    });

    if (!targetFolderId) {
      return NextResponse.json(
        { success: false, error: `Google Drive에서 ${def.defaultDept} > ${def.folderName} 폴더를 생성할 수 없습니다. 서비스 계정 권한을 확인해주세요.` },
        { status: 500 }
      );
    }

    // 2. 점검표 HTML 조립
    const recordMap: Record<string, MonthlyInspectionRecord> = {};
    (records || []).forEach(r => {
      recordMap[r.facilityId] = r;
    });

    const indoorItems = SAFETY_INSPECTION_ITEMS.filter(i => i.section === '실내');
    const corridorItems = SAFETY_INSPECTION_ITEMS.filter(i => i.section === '복도 및 계단');

    // 학년/구분 그룹 정의: 1학년 ~ 6학년, 특별실
    const groups: { title: string; filter: (f: SchoolFacility) => boolean }[] = [
      { title: '1학년', filter: f => f.grade === 1 },
      { title: '2학년', filter: f => f.grade === 2 },
      { title: '3학년', filter: f => f.grade === 3 },
      { title: '4학년', filter: f => f.grade === 4 },
      { title: '5학년', filter: f => f.grade === 5 },
      { title: '6학년', filter: f => f.grade === 6 },
      { title: '특별실', filter: f => !f.grade || f.grade === 0 || f.category === 'special' || f.category === 'admin' }
    ];

    const activeFacilities = facilities.filter(f => f.isActive !== false);

    const tablesHtml = groups
      .map(group => {
        const groupFacilities = activeFacilities.filter(group.filter);
        if (groupFacilities.length === 0) return '';

        const facilityColsHtml = groupFacilities
          .map(fac => `<th style="border: 1px solid #000; padding: 4px 2px; font-size: 12px; font-weight: bold; text-align: center; background: #fff;">${fac.name}</th>`)
          .join('');

        const teacherColsHtml = groupFacilities
          .map(fac => `<td style="border: 1px solid #000; padding: 4px 2px; font-size: 11.5px; font-weight: bold; text-align: center;">${fac.assignedTeacherName || ''}</td>`)
          .join('');

        const signColsHtml = groupFacilities
          .map(fac => {
            const rec = recordMap[fac.id];
            const isDone = rec && rec.isCompleted;
            const teacherName = (fac.assignedTeacherName || rec?.inspectorName || '교사').trim();

            let stampUrl: string | null = null;
            if (isDone) {
              const facEmail = (fac.assignedTeacherEmail || '').toLowerCase().trim();
              const registeredSig = (facEmail && teacherSignatures[facEmail]) || (teacherName && teacherSignatures[teacherName]) || null;

              if (isActualSignature(registeredSig)) {
                stampUrl = registeredSig;
              } else if (isActualSignature(rec.signature)) {
                stampUrl = rec.signature || null;
              } else {
                stampUrl = getTeacherStampSignature(teacherName);
              }
            }

            return `
              <td style="border: 1px solid #000; padding: 2px; text-align: center; height: 36px; vertical-align: middle;">
                ${isDone ? `
                  <div style="position: relative; display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 30px;">
                    <span style="font-size: 10px; color: #bbb;">(인)</span>
                    ${stampUrl ? `<img src="${stampUrl}" alt="인" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply;" />` : ''}
                  </div>
                ` : ''}
              </td>
            `;
          })
          .join('');

        const indoorRowsHtml = indoorItems
          .map((item, idx) => {
            const cellsHtml = groupFacilities
              .map(fac => {
                const rec = recordMap[fac.id];
                const score = rec?.scores?.[item.id] || (rec?.isCompleted ? 'O' : '');
                const scoreColor = score === 'O' ? '#047857' : score === '△' ? '#b45309' : score === '×' ? '#dc2626' : '#000';
                return `<td style="border: 1px solid #000; padding: 3px 2px; text-align: center; font-size: 15px; font-weight: 900; color: ${scoreColor}; vertical-align: middle;">${score}</td>`;
              })
              .join('');

            return `
              <tr style="height: 25px;">
                ${idx === 0 ? `<td rowspan="8" style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; background: #f8fafc; font-size: 12px; width: 44px; vertical-align: middle;">실내</td>` : ''}
                <td style="border: 1px solid #000; padding: 3px 8px; text-align: left; font-size: 11.5px; font-weight: 600; line-height: 1.3; width: 220px; vertical-align: middle; word-break: keep-all;">${item.index}. ${item.name}</td>
                ${cellsHtml}
                <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-size: 10px; width: 75px; vertical-align: middle;"></td>
              </tr>
            `;
          })
          .join('');

        const corridorRowsHtml = corridorItems
          .map((item, idx) => {
            const cellsHtml = groupFacilities
              .map(fac => {
                const rec = recordMap[fac.id];
                const score = rec?.scores?.[item.id] || (rec?.isCompleted ? 'O' : '');
                const scoreColor = score === 'O' ? '#047857' : score === '△' ? '#b45309' : score === '×' ? '#dc2626' : '#000';
                return `<td style="border: 1px solid #000; padding: 3px 2px; text-align: center; font-size: 15px; font-weight: 900; color: ${scoreColor}; vertical-align: middle;">${score}</td>`;
              })
              .join('');

            return `
              <tr style="height: 25px;">
                ${idx === 0 ? `<td rowspan="6" style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; background: #f8fafc; font-size: 12px; width: 44px; vertical-align: middle;">복도 및 계단</td>` : ''}
                <td style="border: 1px solid #000; padding: 3px 8px; text-align: left; font-size: 11.5px; font-weight: 600; line-height: 1.3; width: 220px; vertical-align: middle; word-break: keep-all;">${item.index}. ${item.name}</td>
                ${cellsHtml}
                <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-size: 10px; width: 75px; vertical-align: middle;"></td>
              </tr>
            `;
          })
          .join('');

        return `
          <div class="sheet-page" style="page-break-after: always; padding: 0; margin-bottom: 20px;">
            <div style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 6px;">
              ${yearDisplay} 학교생활 안전점검표 (${monthDisplay}월) - ${group.title}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px; font-size: 10.5px; color: #475569;">
              <div>
                <div>* 매월 4일(해당일 휴일인 경우 그 전후)에 점검을 실시합니다.</div>
                <div style="color: #dc2626; font-weight: bold;">* 각 항목 점검 후 이상이 있을 시, 시설관리팀(내선 520)에 연락합니다.</div>
              </div>
              <div style="font-weight: bold; font-size: 11px; color: #0f172a;">
                좋음: <span style="color: #047857;">O</span> &nbsp;|&nbsp; 보통: <span style="color: #b45309;">△</span> &nbsp;|&nbsp; 나쁨: <span style="color: #dc2626;">×</span>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; table-layout: fixed;">
              <colgroup>
                <col style="width: 44px;" />
                <col style="width: 220px;" />
                ${groupFacilities.map(() => `<col />`).join('')}
                <col style="width: 75px;" />
              </colgroup>
              <thead>
                <tr style="background: #f8fafc; height: 26px;">
                  <th style="width: 44px; border: 1px solid #000; font-size: 11.5px; padding: 3px;">구분</th>
                  <th style="width: 220px; border: 1px solid #000; font-size: 11.5px; padding: 3px; text-align: left; padding-left: 8px;">점검항목</th>
                  <th colspan="${groupFacilities.length}" style="border: 1px solid #000; font-size: 12px; padding: 3px; background: #fffbeb; color: #78350f;">담당장소 (${group.title})</th>
                  <th style="width: 75px; border: 1px solid #000; font-size: 11.5px; padding: 3px;">비고/조치</th>
                </tr>
                <tr style="height: 25px;">
                  <th colspan="2" style="border: 1px solid #000; font-size: 11.5px; padding: 3px; background: #f8fafc;">장소명</th>
                  ${facilityColsHtml}
                  <th style="border: 1px solid #000; font-size: 11px; padding: 2px; color: #475569; background: #f8fafc;">시설팀(520)</th>
                </tr>
                <tr style="height: 25px;">
                  <th colspan="2" style="border: 1px solid #000; font-size: 11.5px; padding: 3px; background: #f8fafc;">담당 교사</th>
                  ${teacherColsHtml}
                  <th style="border: 1px solid #000; background: #fff;"></th>
                </tr>
                <tr style="height: 36px;">
                  <th colspan="2" style="border: 1px solid #000; font-size: 11.5px; padding: 3px; background: #f8fafc;">서명(인)</th>
                  ${signColsHtml}
                  <th style="border: 1px solid #000; background: #fff;"></th>
                </tr>
              </thead>
              <tbody>
                ${indoorRowsHtml}
                ${corridorRowsHtml}
              </tbody>
            </table>
          </div>
        `;
      })
      .filter(Boolean)
      .join('\n');

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <title>${yearDisplay}학년도 학교생활 안전점검표 (${monthDisplay}월)</title>
        <style>
          @page {
            size: 297mm 210mm landscape;
            margin: 8mm 10mm 8mm 10mm;
          }
          @page Section1 {
            size: 841.9pt 595.3pt;
            mso-page-orientation: landscape;
            margin: 18pt 24pt 18pt 24pt;
          }
          div.sheet-page {
            page: Section1;
            mso-page-orientation: landscape;
            box-sizing: border-box;
            width: 100%;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Malgun Gothic', '맑은 고딕', sans-serif;
            color: #000;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sheet-page:last-child {
            page-break-after: avoid !important;
          }
        </style>
      </head>
      <body>
        ${tablesHtml}
      </body>
      </html>
    `;

    // 3. Google Drive API를 통한 고품질 PDF 변환 및 07_안전점검표 폴더 저장
    const fileName = `[안전점검표]_${yearMonth}_학교생활안전점검표.pdf`;
    let finalFileId = '';
    let finalViewLink = '';
    let tempId = '';

    try {
      // HTML을 기반으로 임시 Google Docs 생성 (부모 폴더 지정 필수)
      const tempDoc = await drive.files.create({
        requestBody: {
          name: `temp_safety_${Date.now()}`,
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

      tempId = tempDoc.data.id!;

      // [가로 방향(LANDSCAPE) 강제 설정] Google Docs 문서 스타일을 A4 가로 (297mm x 210mm)로 변경
      try {
        const docs = getGoogleDocsClient();
        await docs.documents.batchUpdate({
          documentId: tempId,
          requestBody: {
            requests: [
              {
                updateDocumentStyle: {
                  documentStyle: {
                    pageSize: {
                      width: { magnitude: 841.89, unit: 'PT' }, // 297mm (A4 Landscape Width)
                      height: { magnitude: 595.28, unit: 'PT' }, // 210mm (A4 Landscape Height)
                    },
                    marginTop: { magnitude: 18, unit: 'PT' },
                    marginBottom: { magnitude: 18, unit: 'PT' },
                    marginLeft: { magnitude: 24, unit: 'PT' },
                    marginRight: { magnitude: 24, unit: 'PT' },
                  },
                  fields: 'pageSize,marginTop,marginBottom,marginLeft,marginRight',
                },
              },
            ],
          },
        });
      } catch (styleErr) {
        console.warn('[archive-safety-inspection] Google Docs 페이지 가로(Landscape) 전환 경고:', styleErr);
      }

      // PDF 내보내기 (export)
      const pdfExport = await drive.files.export(
        {
          fileId: tempId,
          mimeType: 'application/pdf',
        },
        { responseType: 'arraybuffer' }
      );

      const pdfBuffer = Buffer.from(pdfExport.data as ArrayBuffer);

      // 대상 폴더에 최종 PDF 생성
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
    } catch (convertErr: any) {
      console.warn('[archive-safety-inspection] PDF 변환 실패:', convertErr);
      const isQuotaError = String(convertErr.message || '').includes('storage quota') || 
                           String(convertErr.message || '').includes('Service Accounts');

      if (isQuotaError) {
        return NextResponse.json(
          {
            success: false,
            isQuotaError: true,
            error: '구글 서비스 계정 정책상 개인 드라이브 폴더에는 파일 생성이 제한됩니다. Google Drive에서 [공유 드라이브(Shared Drive)]를 생성하여 중앙저장소로 연결해주세요.',
            serviceAccountEmail: process.env.FIREBASE_CLIENT_EMAIL,
            htmlContent: fullHtml,
          },
          { status: 403 }
        );
      }

      // 대체: HTML 형식으로 직접 저장 시도
      try {
        const altFileName = `[안전점검표]_${yearMonth}_학교생활안전점검표.html`;
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
      } catch (htmlErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: htmlErr.message || '파일 저장 중 오류가 발생했습니다.',
            htmlContent: fullHtml,
          },
          { status: 500 }
        );
      }
    } finally {
      // [임시 Google Docs 파일 100% 자동 정리] 공유 드라이브에서 휴지통 이동(trashed: true) 및 영구 삭제
      if (tempId) {
        try {
          await drive.files.update({
            fileId: tempId,
            requestBody: { trashed: true },
            supportsAllDrives: true,
          });
          try {
            await discardDriveTempFile(drive, tempId, '[archive-safety-inspection]');
          } catch {}
        } catch (cleanupErr) {
          console.warn('[archive-safety-inspection] 임시 구글 문서 정리 경고:', cleanupErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${yearMonth} 안전점검표가 Google Drive 07_안전점검표 폴더에 성공적으로 저장되었습니다.`,
      fileId: finalFileId,
      webViewLink: finalViewLink,
      fileName,
      folderId: targetFolderId,
      folderUrl: targetFolderUrl,
    });
  } catch (error: any) {
    console.error('[archive-safety-inspection] 처리 오류:', error);
    const isQuotaError = String(error.message || '').includes('storage quota') || 
                         String(error.message || '').includes('Service Accounts');
    return NextResponse.json(
      {
        success: false,
        isQuotaError,
        error: isQuotaError 
          ? '구글 서비스 계정 정책상 개인 드라이브 폴더에는 파일 생성이 제한됩니다. Google Drive에서 [공유 드라이브(Shared Drive)]를 생성하여 중앙저장소로 연결해주세요.'
          : (error.message || '안전점검표 Google Drive 아카이빙 처리 중 오류가 발생했습니다.'),
        serviceAccountEmail: process.env.FIREBASE_CLIENT_EMAIL,
      },
      { status: 500 }
    );
  }
}
