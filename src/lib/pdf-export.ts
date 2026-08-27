import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

/**
 * 화면에 렌더링된 DOM 요소(페이지별)를 브라우저 실제 픽셀 그대로 고해상도(scale 2)로 캡처하여
 * 정확히 210mm x 297mm (A4) 규격의 멀티페이지 PDF 파일로 생성 및 다운로드합니다.
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
    if (onProgress) onProgress(`[${i + 1}/${pageElements.length}] 화면 그대로 고화질 캡처 중...`);

    // 브라우저 렌더링 엔진(SVG foreignObject)을 통해 화면 픽셀 그대로 완벽 복제
    const dataUrl = await toPng(el, {
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    // A4 크기 (210mm x 297mm)에 오차 없이 1:1 배치
    pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  }

  if (onProgress) onProgress('PDF 다운로드 완료!');
  pdf.save(fileName);
}
