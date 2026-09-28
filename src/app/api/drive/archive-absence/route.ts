import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveClient } from '@/lib/server/googleAuth';
import { Readable } from 'stream';
import { format } from 'date-fns';

interface ArchiveRequestBody {
  docId: string;
  docData: any;
  academicYear?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ArchiveRequestBody = await req.json();
    const { docId, docData } = body;

    if (!docId || !docData) {
      return NextResponse.json(
        { success: false, error: 'docId 및 docData가 필요합니다.' },
        { status: 400 }
      );
    }

    const pData = docData.parentFormData || {};
    const isAbsence = pData.type === 'absence';
    if (!isAbsence) {
      return NextResponse.json(
        { success: false, error: '결석계 문서만 결석계 폴더에 아카이빙할 수 있습니다.' },
        { status: 400 }
      );
    }

    const drive = getGoogleDriveClient();

    // 1. 중앙 저장소 설정 및 결석계 완료 폴더 ID 확인
    // 현재 학년도 계산 (3월 기준)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const academicYear = body.academicYear || String(currentMonth >= 3 ? currentYear : currentYear - 1);

    // rootFolderId 환경변수 또는 sync-folders 호출
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    let targetFolderId: string | null = null;

    // 만약 rootFolderId가 설정되어 있다면 학년도 폴더 내 '03_결석계(완료)' 검색/생성
    if (rootFolderId) {
      try {
        const yearFolderName = `${academicYear}학년도`;
        const rootList = await drive.files.list({
          q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        let yearFolder = rootList.data.files?.find(f => f.name === yearFolderName);
        let yearFolderId = yearFolder?.id;

        if (!yearFolderId) {
          const newYf = await drive.files.create({
            requestBody: {
              name: yearFolderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [rootFolderId],
            },
            fields: 'id',
            supportsAllDrives: true,
          });
          yearFolderId = newYf.data.id!;
        }

        // '03_결석계(완료)' 검색 또는 생성
        const subList = await drive.files.list({
          q: `'${yearFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        const absenceFolder = subList.data.files?.find(
          f => f.name === '03_결석계(완료)' || (f.name && f.name.includes('결석계'))
        );

        if (absenceFolder?.id) {
          targetFolderId = absenceFolder.id;
        } else {
          const newAf = await drive.files.create({
            requestBody: {
              name: '03_결석계(완료)',
              mimeType: 'application/vnd.google-apps.folder',
              parents: [yearFolderId],
            },
            fields: 'id',
            supportsAllDrives: true,
          });
          targetFolderId = newAf.data.id!;
        }
      } catch (fErr) {
        console.warn('[archive-absence] 루트 폴더 탐색 경고, 대체 폴더 검색 진행:', fErr);
      }
    }

    // 만약 targetFolderId가 없다면 드라이브 전체에서 '03_결석계(완료)' 폴더 검색
    if (!targetFolderId) {
      const searchRes = await drive.files.list({
        q: "name = '03_결석계(완료)' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      if (searchRes.data.files && searchRes.data.files.length > 0) {
        targetFolderId = searchRes.data.files[0].id!;
      }
    }

    if (!targetFolderId) {
      return NextResponse.json(
        { success: false, error: 'Google Drive에 03_결석계(완료) 폴더를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 결석계 HTML 생성
    const rawGc = String(pData.gradeClassNumber || '').trim();
    const parts = rawGc.replace(/[^0-9-]/g, '-').split('-').filter(Boolean);
    const grade = parts[0] || '1';
    const studentClass = parts[1] || '1';
    const number = parts[2] || '';
    const studentName = pData.studentName || '학생';
    const docNo = docData.docNo || 'NO-DOC';
    const startDate = pData.absencePeriod?.startDate || '';
    const endDate = pData.absencePeriod?.endDate || '';
    const totalDays = pData.absencePeriod?.totalDays || 1;
    const absenceReason = pData.absenceReason || '-';
    const parentName = pData.parentName || '학부모';
    const applyDate = pData.applyDate || format(new Date(), 'yyyy-MM-dd');
    const absenceType = pData.absenceType || '병결';
    const teacherConfirmMethod = pData.teacherConfirmMethod || '전화/문자';
    const teacherConfirmDate = pData.teacherConfirmDate || applyDate;

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

    // 소견서 이미지 확인
    const certImage =
      pData.medicalCertificateUrl ||
      docData.medicalCertificateUrl ||
      (Array.isArray(pData.attachments) && pData.attachments[0]?.data) ||
      (Array.isArray(docData.attachments) && docData.attachments[0]?.data) ||
      '';

    const certPageHtml = certImage
      ? `
        <div style="page-break-before: always; width: 100%; min-height: 275mm; padding: 15mm; box-sizing: border-box; background-color: #fff; font-family: 'Batang', serif;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
            <div>
              <div style="font-size: 9pt; color: #475569;">&lt;서식 3 부속 첨부 증빙&gt;</div>
              <h2 style="font-size: 16pt; font-weight: 900; letter-spacing: 0.2em; margin: 2px 0 0 0;">
                결석계 증빙서류 (소견서·진단서)
              </h2>
            </div>
            <div style="text-align: right; font-size: 9pt; color: #334155; line-height: 1.4;">
              <div><b>학생명:</b> ${studentName} (${grade}학년 ${studentClass}반 ${number}번)</div>
              <div><b>결석기간:</b> ${startDate} ~ ${endDate} (${totalDays}일간)</div>
            </div>
          </div>
          <div style="font-size: 8pt; color: #64748b; margin-bottom: 10px;">
            ※ 본 증빙자료는 학부모(또는 학생)가 제출한 의사소견서/진료확인서/처방전 원본 보관본입니다.
          </div>
          <div style="text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; background-color: #f8fafc; min-height: 200mm; display: flex; align-items: center; justify-content: center;">
            <img src="${certImage}" style="max-width: 100%; max-height: 210mm; object-fit: contain;" alt="소견서/진단서 원본" />
          </div>
          <div style="padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 8pt; color: #64748b; margin-top: 12px;">
            <span>호치민시한국국제학교 학생 결석계 첨부 증빙서류 보관본</span>
            <span>문서번호: ${docNo}</span>
          </div>
        </div>
      `
      : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>결석계_${studentName}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: 'Batang', 'Nanum Myeongjo', serif; margin: 0; padding: 0; color: #000; background-color: #fff; }
          .page-box { width: 100%; max-width: 190mm; margin: 0 auto; box-sizing: border-box; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 9.5pt; }
          th, td { border: 1px solid #000; padding: 4px 8px; }
          th { background-color: #f8fafc; font-weight: bold; text-align: center; }
        </style>
      </head>
      <body>
        <div class="page-box">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-size: 8.5pt; color: #334155; margin-bottom: 2px;">&lt;서식 3&gt;</div>
              <h1 style="font-size: 20pt; font-weight: 900; letter-spacing: 0.4em; margin: 0; text-align: center;">결 석 계</h1>
              <div style="font-size: 8pt; color: #dc2626; font-weight: bold; text-align: center; margin-top: 2px;">(결석한 날부터 5일 이내 제출)</div>
            </div>
            <div style="flex-shrink: 0; margin-left: 10px;">
              <table style="border-collapse: collapse; border: 1px solid #000;">
                <tr>
                  <td rowspan="2" style="width: 20px; font-size: 8pt; font-weight: bold; background-color: #f1f5f9; text-align: center; padding: 2px;">결<br/>재</td>
                  ${approverTds}
                </tr>
              </table>
            </div>
          </div>

          <table style="margin-bottom: 12px;">
            <tr style="height: 34px;">
              <th style="width: 90px;">소 속</th>
              <td>호치민시한국국제학교 &nbsp;&nbsp;&nbsp; ${grade} 학년 &nbsp;( &nbsp;${studentClass}&nbsp; )반 &nbsp;( &nbsp;${number}&nbsp; )번</td>
            </tr>
            <tr style="height: 34px;">
              <th>학 생 명</th>
              <td style="font-weight: bold;">${studentName}</td>
            </tr>
            <tr style="height: 36px;">
              <td colspan="2" style="text-align: center; font-size: 10pt;">위 학생은 다음과 같은 사유로 결석하였기에 결석계를 제출합니다.</td>
            </tr>
            <tr style="height: 34px;">
              <th>결석기간</th>
              <td>${startDate} 부터 &nbsp;&nbsp; ${endDate} 까지 &nbsp; ( <b>${totalDays}</b> 일간)</td>
            </tr>
            <tr style="height: 120px;">
              <th style="vertical-align: middle;">결석사유</th>
              <td style="vertical-align: top; line-height: 1.6; white-space: pre-wrap;">${absenceReason}</td>
            </tr>
            <tr style="height: 110px;">
              <td colspan="2" style="text-align: center; vertical-align: middle; padding: 12px;">
                <div style="margin-bottom: 10px; font-size: 9.5pt; font-weight: bold;">${applyDate}</div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; padding-right: 40px; font-size: 9.5pt;">
                  <div>학 생 : <b>${studentName}</b> &nbsp;&nbsp; (인)</div>
                  <div style="margin-top: 4px;">학부모 : <b style="color: #1e3a8a;">${parentName}</b> &nbsp;&nbsp; (인)</div>
                </div>
                <div style="text-align: center; font-weight: 900; font-size: 13pt; letter-spacing: 0.2em; margin-top: 10px;">
                  호치민시한국국제학교장 귀하
                </div>
              </td>
            </tr>
          </table>

          <div style="text-align: center; font-size: 12pt; font-weight: bold; letter-spacing: 0.3em; margin: 10px 0 6px 0;">확 인 서</div>

          <table>
            <tr style="height: 36px;">
              <th style="width: 90px;">구 분</th>
              <td style="text-align: center; font-size: 8.5pt;">
                병결 [ ${absenceType === '병결' ? 'O' : ' '} ] &nbsp;&nbsp;&nbsp;
                미인정 결석 [ ${absenceType === '미인정' ? 'O' : ' '} ] &nbsp;&nbsp;&nbsp;
                기타결 [ ${absenceType === '기타' ? 'O' : ' '} ]<br/>
                출석인정(경조사, 법정전염병, 생리결석, 비자) [ ${absenceType === '출석인정' ? 'O' : ' '} ]
              </td>
            </tr>
            <tr style="height: 120px;">
              <td colspan="2" style="vertical-align: top; padding: 10px; font-size: 9pt; line-height: 1.7;">
                <div style="text-align: center; font-weight: bold; margin-bottom: 8px;">위 제출 내용이 사실과 다름없음을 확인함.</div>
                <div>1. 확인방법: 전화/문자(${teacherConfirmMethod === '전화/문자' ? 'O' : ' '}), 학부모 내교(${teacherConfirmMethod === '학부모 내교' ? 'O' : ' '}), 가정방문(${teacherConfirmMethod === '가정방문' ? 'O' : ' '}), 기타(${teacherConfirmMethod === '기타' ? 'O' : ' '})</div>
                <div>2. 확인내용: 결석 사유와 동일함을 확인합니다.</div>
                <div>3. 확인일시: ${teacherConfirmDate}</div>
                <div style="text-align: center; margin-top: 12px; font-weight: bold;">${teacherConfirmDate}</div>
              </td>
            </tr>
          </table>
        </div>

        ${certPageHtml}
      </body>
      </html>
    `;

    const fileName = `[결석계]_${grade}학년${studentClass}반_${studentName}_${startDate}_${docNo}.pdf`;

    let finalFileId = '';
    let finalViewLink = '';

    // 3. Google Docs -> PDF 변환 및 폴더 저장 시도
    try {
      const tempDoc = await drive.files.create({
        requestBody: {
          name: `temp_convert_${docNo}`,
          mimeType: 'application/vnd.google-apps.document',
        },
        media: {
          mimeType: 'text/html',
          body: htmlContent,
        },
        fields: 'id',
        supportsAllDrives: true,
      });

      const tempId = tempDoc.data.id!;

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

      // 임시 파일 정리
      try {
        await drive.files.delete({ fileId: tempId, supportsAllDrives: true });
      } catch {}
    } catch (convertErr) {
      console.warn('[archive-absence] PDF 변환 실패, HTML 원본으로 직접 저장 대체:', convertErr);
      // 대체: HTML 형식으로 직접 저장
      const altFileName = `[결석계]_${grade}학년${studentClass}반_${studentName}_${startDate}_${docNo}.html`;
      const htmlBuffer = Buffer.from(htmlContent, 'utf-8');
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
      message: '결석계가 Google Drive에 성공적으로 아카이빙되었습니다.',
      file: {
        id: finalFileId,
        name: fileName,
        webViewLink: finalViewLink,
        folderId: targetFolderId,
      },
    });
  } catch (error: any) {
    console.error('[archive-absence] 아카이빙 에러:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Google Drive 아카이빙 중 오류 발생' },
      { status: 500 }
    );
  }
}
