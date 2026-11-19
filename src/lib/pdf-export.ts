import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * 화면에 렌더링된 DOM 요소(페이지별)를 html2canvas로 안정적으로 캡처하여
 * 백지 현상 없이 정확히 210mm x 297mm (A4) 규격의 PDF 파일로 생성 및 다운로드합니다.
 */
export async function exportA4PagesToPdf(
  pageElements: HTMLElement[],
  fileName: string = '문서.pdf',
  onProgress?: (msg: string) => void
): Promise<void> {
  if (!pageElements || pageElements.length === 0) {
    throw new Error('PDF로 변환할 페이지 요소를 찾을 수 없습니다.');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  for (let i = 0; i < pageElements.length; i++) {
    const el = pageElements[i];
    if (onProgress) onProgress(`[${i + 1}/${pageElements.length}] 문서 렌더링 중...`);

    // html2canvas로 DOM 노드를 직접 Canvas로 안정적으로 렌더링
    const canvas = await html2canvas(el, {
      scale: 2, // 고화질 2배율
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: el.scrollWidth || el.offsetWidth,
      windowHeight: el.scrollHeight || el.offsetHeight,
      onclone: (clonedDoc, clonedEl) => {
        // 클론된 요소에서 그림자 및 스크롤바 완전 제거
        clonedEl.style.boxShadow = 'none';
        clonedEl.style.border = 'none';
        clonedEl.style.margin = '0 auto';
        clonedEl.style.overflow = 'visible';
      }
    });

    const imgData = canvas.toDataURL('image/png', 1.0);

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    // A4 크기 (210mm x 297mm) 정비율 배치
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= 297) {
      pdf.addImage(imgData, 'PNG', 0, 0, 210, imgHeight, undefined, 'FAST');
    } else {
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    }
  }

  if (onProgress) onProgress('PDF 다운로드 완료!');
  pdf.save(fileName);
}

/**
 * 화면에 렌더링된 DOM 요소(페이지별)를 캡처하여 정확히 A4 규격의 PDF Blob 객체로 반환합니다.
 * orientation 옵션으로 세로(portrait) 또는 가로(landscape)를 완벽 지원합니다.
 * Google Drive 업로드 및 백엔드 전송에 사용됩니다.
 */
export async function generateA4PdfBlob(
  pageElements: HTMLElement[],
  optionsOrProgress?:
    | ((msg: string) => void)
    | {
        orientation?: 'portrait' | 'landscape';
        onProgress?: (msg: string) => void;
      }
): Promise<Blob> {
  if (!pageElements || pageElements.length === 0) {
    throw new Error('PDF로 변환할 페이지 요소를 찾을 수 없습니다.');
  }

  const isLandscape =
    typeof optionsOrProgress === 'object' && optionsOrProgress?.orientation === 'landscape';
  const onProgress =
    typeof optionsOrProgress === 'function'
      ? optionsOrProgress
      : optionsOrProgress?.onProgress;

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  for (let i = 0; i < pageElements.length; i++) {
    const el = pageElements[i];
    if (onProgress) onProgress(`[${i + 1}/${pageElements.length}] 페이지 렌더링 중...`);

    const canvas = await html2canvas(el, {
      scale: 2, // 고화질 2배율
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: el.scrollWidth || el.offsetWidth,
      windowHeight: el.scrollHeight || el.offsetHeight,
      onclone: (clonedDoc, clonedEl) => {
        clonedEl.style.boxShadow = 'none';
        clonedEl.style.border = 'none';
        clonedEl.style.margin = '0 auto';
        clonedEl.style.overflow = 'visible';
      }
    });

    const imgData = canvas.toDataURL('image/png', 1.0);

    if (i > 0) {
      pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
    }

    if (isLandscape) {
      // A4 가로: 297mm x 210mm
      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= 210) {
        pdf.addImage(imgData, 'PNG', 0, 0, 297, imgHeight, undefined, 'FAST');
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
      }
    } else {
      // A4 세로: 210mm x 297mm
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= 297) {
        pdf.addImage(imgData, 'PNG', 0, 0, 210, imgHeight, undefined, 'FAST');
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }
    }
  }

  return pdf.output('blob');
}
