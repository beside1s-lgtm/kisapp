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
