'use client';

import React from 'react';
import { buildStaffAuthHeaders } from '@/lib/staffApiHeaders';
import type { SchoolFacility, MonthlyInspectionRecord } from '@/lib/safety/types';
import { SAFETY_INSPECTION_ITEMS } from '@/lib/safety/types';
import { getTeacherStampSignature, isActualSignature } from '@/lib/safety/stampHelper';
import { getTeacherSignaturesDirectory } from '@/lib/services/userService';
import { generateA4PdfBlob } from '@/lib/pdf-export';
import { getGoogleDriveConfig } from '@/lib/services/settingsService';

export interface InspectionPrintModalProps {
  facilities: SchoolFacility[];
  records: MonthlyInspectionRecord[];
  yearMonth: string;
  grade?: number | string; // 특정 학년('1'~'6', 'special') 또는 전체('all' / undefined)
  teacherSignatures?: Record<string, string>;
}

interface PageGroup {
  title: string;
  facilities: SchoolFacility[];
}

/**
 * 안전점검표 학년별/권역별 페이지 그룹을 구성합니다.
 */
function getInspectionPageGroups(
  facilities: SchoolFacility[],
  targetGrade?: number | string
): PageGroup[] {
  const activeFacilities = facilities.filter((f) => f.isActive !== false);
  const groups: PageGroup[] = [];
  const gradeStr = targetGrade !== undefined ? String(targetGrade).trim() : 'all';

  if (gradeStr !== 'all' && gradeStr !== '') {
    if (gradeStr === 'special') {
      const facs = activeFacilities.filter(
        (f) => !f.grade || f.grade === 0 || f.category === 'special' || f.category === 'common'
      );
      if (facs.length > 0) {
        groups.push({ title: '특별실 및 관리실', facilities: facs });
      }
    } else {
      const gNum = parseInt(gradeStr, 10);
      const facs = activeFacilities.filter((f) => f.grade === gNum);
      if (facs.length > 0) {
        groups.push({ title: `${gNum}학년`, facilities: facs });
      }
    }
  } else {
    // 1학년부터 6학년까지 각 1페이지, 마지막에 특별실 1페이지
    for (let g = 1; g <= 6; g++) {
      const facs = activeFacilities.filter((f) => f.grade === g);
      if (facs.length > 0) {
        groups.push({ title: `${g}학년`, facilities: facs });
      }
    }
    const specialFacs = activeFacilities.filter(
      (f) => !f.grade || f.grade === 0 || f.category === 'special' || f.category === 'common'
    );
    if (specialFacs.length > 0) {
      groups.push({ title: '특별실 및 관리실', facilities: specialFacs });
    }
  }

  return groups;
}

/**
 * 학년별 안전점검표 A4 가로 인쇄 서식 HTML을 생성합니다.
 */
function buildSafetyInspectionHtml(
  groups: PageGroup[],
  records: MonthlyInspectionRecord[],
  yearMonth: string,
  teacherSignatures: Record<string, string>
): { pagesHtml: string; fullHtml: string } {
  const monthDisplay = parseInt(yearMonth.split('-')[1] || '11', 10);
  const yearDisplay = yearMonth.split('-')[0] || '2026';

  const recordMap: Record<string, MonthlyInspectionRecord> = {};
  records.forEach((r) => {
    recordMap[r.facilityId] = r;
  });

  const indoorItems = SAFETY_INSPECTION_ITEMS.filter((i) => i.section === '실내');
  const corridorItems = SAFETY_INSPECTION_ITEMS.filter((i) => i.section === '복도 및 계단');

  const pagesHtml = groups
    .map((grp, pageIdx) => {
      const isLastPage = pageIdx === groups.length - 1;
      const grpFacilities = grp.facilities;

      // 1. 장소명 헤더 컬럼
      const facilityColsHtml = grpFacilities
        .map(
          (fac) =>
            `<th style="border: 1px solid #000000; padding: 4px 2px; font-size: 12px; font-weight: bold; text-align: center; background: #ffffff; vertical-align: middle;">
              ${fac.name}
            </th>`
        )
        .join('');

      // 2. 담당교사 헤더 컬럼
      const teacherColsHtml = grpFacilities
        .map(
          (fac) =>
            `<td style="border: 1px solid #000000; padding: 4px 2px; font-size: 11.5px; font-weight: bold; text-align: center; color: #1e293b; vertical-align: middle;">
              ${fac.assignedTeacherName || ''}
            </td>`
        )
        .join('');

      // 3. 서명(인) 헤더 컬럼
      const signColsHtml = grpFacilities
        .map((fac) => {
          const rec = recordMap[fac.id];
          const isDone = rec && rec.isCompleted;
          const teacherName = (fac.assignedTeacherName || rec?.inspectorName || '교사').trim();

          let stampUrl: string | null = null;
          if (isDone) {
            const facEmail = (fac.assignedTeacherEmail || '').toLowerCase().trim();
            const registeredSig =
              (facEmail && teacherSignatures[facEmail]) ||
              (teacherName && teacherSignatures[teacherName]) ||
              null;

            if (isActualSignature(registeredSig)) {
              stampUrl = registeredSig;
            } else if (isActualSignature(rec.signature)) {
              stampUrl = rec.signature || null;
            } else {
              stampUrl = getTeacherStampSignature(teacherName);
            }
          }

          return `
            <td style="border: 1px solid #000000; padding: 2px; text-align: center; height: 36px; vertical-align: middle;">
              ${
                isDone
                  ? `
                <div style="position: relative; display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 30px;">
                  <span style="font-size: 10px; color: #cbd5e1; font-weight: normal;">(인)</span>
                  ${
                    stampUrl
                      ? `<img src="${stampUrl}" alt="" onerror="this.src='${getTeacherStampSignature(teacherName)}';" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply;" />`
                      : ''
                  }
                </div>
              `
                  : ''
              }
            </td>
          `;
        })
        .join('');

      // 4. 실내 점검항목 행 (8개)
      const indoorRowsHtml = indoorItems
        .map((item, idx) => {
          const cellsHtml = grpFacilities
            .map((fac) => {
              const rec = recordMap[fac.id];
              const score = rec?.scores?.[item.id] || (rec?.isCompleted ? 'O' : '');
              const scoreColor =
                score === 'O' ? '#047857' : score === '△' ? '#b45309' : score === '×' ? '#dc2626' : '#000000';
              return `<td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; font-size: 15px; font-weight: 900; color: ${scoreColor}; vertical-align: middle;">${score}</td>`;
            })
            .join('');

          return `
            <tr style="height: 25px;">
              ${
                idx === 0
                  ? `<td rowspan="8" style="border: 1px solid #000000; padding: 4px; text-align: center; font-weight: bold; background: #f8fafc; font-size: 12px; vertical-align: middle; width: 44px;">실내</td>`
                  : ''
              }
              <td style="border: 1px solid #000000; padding: 3px 8px; text-align: left; font-size: 11.5px; font-weight: 600; line-height: 1.3; vertical-align: middle; word-break: keep-all; width: 220px;">
                ${item.index}. ${item.name}
              </td>
              ${cellsHtml}
              <td style="border: 1px solid #000000; padding: 2px 4px; text-align: center; font-size: 10px; color: #64748b; vertical-align: middle; width: 75px;"></td>
            </tr>
          `;
        })
        .join('');

      // 5. 복도 및 계단 점검항목 행 (6개)
      const corridorRowsHtml = corridorItems
        .map((item, idx) => {
          const cellsHtml = grpFacilities
            .map((fac) => {
              const rec = recordMap[fac.id];
              const score = rec?.scores?.[item.id] || (rec?.isCompleted ? 'O' : '');
              const scoreColor =
                score === 'O' ? '#047857' : score === '△' ? '#b45309' : score === '×' ? '#dc2626' : '#000000';
              return `<td style="border: 1px solid #000000; padding: 3px 2px; text-align: center; font-size: 15px; font-weight: 900; color: ${scoreColor}; vertical-align: middle;">${score}</td>`;
            })
            .join('');

          return `
            <tr style="height: 25px;">
              ${
                idx === 0
                  ? `<td rowspan="6" style="border: 1px solid #000000; padding: 4px; text-align: center; font-weight: bold; background: #f8fafc; font-size: 12px; vertical-align: middle; width: 44px;">복도 및 계단</td>`
                  : ''
              }
              <td style="border: 1px solid #000000; padding: 3px 8px; text-align: left; font-size: 11.5px; font-weight: 600; line-height: 1.3; vertical-align: middle; word-break: keep-all; width: 220px;">
                ${item.index}. ${item.name}
              </td>
              ${cellsHtml}
              <td style="border: 1px solid #000000; padding: 2px 4px; text-align: center; font-size: 10px; color: #64748b; vertical-align: middle; width: 75px;"></td>
            </tr>
          `;
        })
        .join('');

      return `
        <div class="safety-page" style="page-break-after: ${isLastPage ? 'auto' : 'always'}; break-after: ${isLastPage ? 'auto' : 'page'}; width: 297mm; min-height: 200mm; background: #ffffff; padding: 6mm 8mm; box-sizing: border-box;">
          <div class="page-title-box" style="margin-bottom: 6px;">
            <h2 class="title" style="text-align: center; font-size: 18px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.5px;">${yearDisplay} 학교생활 안전점검표 (${monthDisplay}월) - ${grp.title}</h2>
            <div class="header-meta" style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 10.5px; margin-bottom: 2px;">
              <div class="guidelines" style="font-size: 10.5px; line-height: 1.3;">
                <div>* 매월 4일(해당일 휴일인 경우 그 전후)에 점검을 실시합니다.</div>
                <div style="color: #dc2626; font-weight: bold;">* 각 항목 점검 후 이상이 있을 시, 시설관리팀(520)에 연락합니다.</div>
              </div>
              <div class="legend" style="text-align: right; font-size: 11px; font-weight: 800;">
                <span style="color: #047857;">좋음 : O</span> &nbsp;&nbsp;|&nbsp;&nbsp;
                <span style="color: #b45309;">보통 : △</span> &nbsp;&nbsp;|&nbsp;&nbsp;
                <span style="color: #dc2626;">나쁨 : ×</span>
              </div>
            </div>
          </div>

          <table class="inspection-table" style="width: 100%; border-collapse: collapse; border: 1.5px solid #000000; table-layout: fixed;">
            <colgroup>
              <col style="width: 44px;" />
              <col style="width: 220px;" />
              ${grpFacilities.map(() => `<col />`).join('')}
              <col style="width: 75px;" />
            </colgroup>
            <thead>
              <tr style="height: 26px; background: #f8fafc;">
                <th style="width: 44px; font-size: 11.5px; border: 1px solid #000000;">구분</th>
                <th style="width: 220px; text-align: left; padding-left: 8px; font-size: 11.5px; border: 1px solid #000000;">점검항목</th>
                <th colspan="${grpFacilities.length}" style="text-align: center; font-size: 12px; font-weight: bold; background: #fffbeb; color: #78350f; border: 1px solid #000000;">
                  담당장소 (${grp.title})
                </th>
                <th style="width: 75px; font-size: 11.5px; border: 1px solid #000000;">비고/조치</th>
              </tr>
              <tr style="height: 25px;">
                <th colspan="2" style="font-size: 11.5px; background: #f8fafc; border: 1px solid #000000;">장소명</th>
                ${facilityColsHtml}
                <th style="font-size: 11px; color: #475569; background: #f8fafc; border: 1px solid #000000;">시설팀(520)</th>
              </tr>
              <tr style="height: 25px;">
                <th colspan="2" style="font-size: 11.5px; background: #f8fafc; border: 1px solid #000000;">담당 교사</th>
                ${teacherColsHtml}
                <th style="background: #ffffff; border: 1px solid #000000;"></th>
              </tr>
              <tr style="height: 36px;">
                <th colspan="2" style="font-size: 11.5px; background: #f8fafc; border: 1px solid #000000;">서명(인)</th>
                ${signColsHtml}
                <th style="background: #ffffff; border: 1px solid #000000;"></th>
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
    .join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="utf-8" />
      <title>${yearDisplay}학년도 학교생활 안전점검표 (${monthDisplay}월)</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 8mm 10mm 8mm 10mm;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", "Segoe UI", sans-serif;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color: #000000;
        }
        .safety-page {
          box-sizing: border-box !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 190mm !important;
          padding: 0 !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: flex-start !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        .safety-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        table.inspection-table {
          width: 100% !important;
          border-collapse: collapse !important;
          border: 1.5px solid #000000 !important;
          table-layout: fixed !important;
        }
        table.inspection-table th, table.inspection-table td {
          border: 1px solid #000000 !important;
          box-sizing: border-box !important;
        }
        @media print {
          body {
            background: #ffffff !important;
          }
          .safety-page {
            page-break-after: always !important;
            break-after: page !important;
          }
          .safety-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `;

  return { pagesHtml, fullHtml };
}

/**
 * [전역 표준] 브라우저 인쇄 창 열기
 */
export async function openSafetyInspectionPrintWindow(
  facilities: SchoolFacility[],
  records: MonthlyInspectionRecord[],
  yearMonth: string,
  targetGrade?: number | string,
  propSignatures?: Record<string, string>
) {
  const teacherSignatures = propSignatures || (await getTeacherSignaturesDirectory());
  const groups = getInspectionPageGroups(facilities, targetGrade);

  if (groups.length === 0) {
    alert('출력할 안전점검 대상 시설이 없습니다.');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1150,height=850');
  if (!printWindow) {
    alert('팝업 차단이 설정되어 있어 인쇄 창을 열 수 없습니다. 브라우저 설정에서 팝업을 허용해주세요.');
    return;
  }

  const { fullHtml } = buildSafetyInspectionHtml(groups, records, yearMonth, teacherSignatures);

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
}

/**
 * [핵심] 인쇄 버튼을 눌렀을 때 만들어지는 출력물 서식 그대로 캡처하여
 * 백엔드 문서 변환 없이 1:1 정확한 A4 Landscape(가로) PDF Blob을 생성합니다.
 */
export async function generateSafetyInspectionPdfBlob(
  facilities: SchoolFacility[],
  records: MonthlyInspectionRecord[],
  yearMonth: string,
  targetGrade?: number | string,
  propSignatures?: Record<string, string>,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  const teacherSignatures = propSignatures || (await getTeacherSignaturesDirectory());
  const groups = getInspectionPageGroups(facilities, targetGrade);

  if (groups.length === 0) {
    throw new Error('출력할 안전점검 대상 시설이 없습니다.');
  }

  const { pagesHtml } = buildSafetyInspectionHtml(groups, records, yearMonth, teacherSignatures);

  // 숨김 렌더링 컨테이너 생성 (사용자 화면 방해 없이 정확한 297mm 너비로 렌더링)
  const hiddenContainer = document.createElement('div');
  hiddenContainer.id = '__safety_print_render_container__';
  hiddenContainer.style.position = 'fixed';
  hiddenContainer.style.left = '-99999px';
  hiddenContainer.style.top = '0';
  hiddenContainer.style.width = '297mm';
  hiddenContainer.style.background = '#ffffff';
  hiddenContainer.style.zIndex = '-9999';
  hiddenContainer.innerHTML = pagesHtml;
  document.body.appendChild(hiddenContainer);

  try {
    // 이미지/직인 로딩 안정화 대기
    await new Promise((resolve) => setTimeout(resolve, 300));

    const pageElements = Array.from(hiddenContainer.querySelectorAll('.safety-page')) as HTMLElement[];
    if (pageElements.length === 0) {
      throw new Error('인쇄 서식 페이지를 렌더링할 수 없습니다.');
    }

    // A4 가로(Landscape) 규격으로 1:1 캡처하여 PDF Blob 생성
    const blob = await generateA4PdfBlob(pageElements, {
      orientation: 'landscape',
      onProgress,
    });

    return blob;
  } finally {
    if (hiddenContainer.parentNode) {
      hiddenContainer.parentNode.removeChild(hiddenContainer);
    }
  }
}

/**
 * [핵심] 인쇄 버튼을 누르면 만들어지는 바로 그 PDF 출력물을 그대로 Google Drive에 저장합니다.
 * 백엔드 임시 Docs 문서 생성을 100% 제거하고, /api/drive/upload-file 로 다이렉트 업로드합니다.
 */
export async function saveSafetyInspectionToGoogleDrive(
  facilities: SchoolFacility[],
  records: MonthlyInspectionRecord[],
  yearMonth: string,
  targetGrade?: number | string,
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; webViewLink?: string; fileId?: string; error?: string }> {
  try {
    // 1. Google Drive 07_안전점검표 폴더 ID 조회
    if (onProgress) onProgress('Google Drive 폴더 설정 확인 중...');
    const driveConfig = await getGoogleDriveConfig();
    const academicYear = yearMonth.split('-')[0] || '2026';
    const targetFolderId = driveConfig.yearlyFolders?.[academicYear]?.safetyInspectionId;

    if (!targetFolderId) {
      throw new Error("Google Drive '안전점검표' 폴더가 설정되지 않았습니다. 시스템 설정의 조직도(부서 관리) 또는 일반 탭에서 드라이브 동기화를 먼저 진행해주세요.");
    }

    // 2. 인쇄 출력물 그대로 1:1 캡처한 A4 가로 PDF Blob 생성
    if (onProgress) onProgress('인쇄 출력 서식 A4 가로 PDF 생성 중...');
    const pdfBlob = await generateSafetyInspectionPdfBlob(
      facilities,
      records,
      yearMonth,
      targetGrade,
      undefined,
      onProgress
    );

    // 3. /api/drive/upload-file 엔드포인트로 직접 업로드 (백엔드 문서 생성 0%)
    if (onProgress) onProgress('Google Drive 안전점검표 폴더로 업로드 중...');
    const fileName = `[안전점검표]_${yearMonth}_학교생활안전점검표.pdf`;

    const formData = new FormData();
    formData.append('file', pdfBlob, fileName);
    formData.append('folderId', targetFolderId);
    formData.append('fileName', fileName);

    const uploadRes = await fetch('/api/drive/upload-file', {
      method: 'POST',
      headers: await buildStaffAuthHeaders(),
      body: formData,
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.success) {
      throw new Error(uploadData.error || 'Google Drive 업로드에 실패했습니다.');
    }

    return {
      success: true,
      fileId: uploadData.file?.id,
      webViewLink: uploadData.file?.webViewLink || `https://drive.google.com/file/d/${uploadData.file?.id}/view`,
    };
  } catch (err: any) {
    console.error('[SaveSafetyToDrive] 오류:', err);
    return {
      success: false,
      error: err.message || '안전점검표 드라이브 저장 중 오류가 발생했습니다.',
    };
  }
}
