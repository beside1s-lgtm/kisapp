'use client';

/**
 * 인쇄용 A4 HTML 문서를 브라우저 렌더링 그대로(WYSIWYG) PDF로 변환한다.
 *
 * 기존에는 HTML을 Google Docs로 변환한 뒤 PDF로 내보냈는데, Docs 변환 과정에서
 * 표 너비·셀 높이·이미지 크기·용지 규격(A4→Letter) 등이 무시되어 결재칸과 표가 틀어졌다.
 * 이 렌더러는 화면의 [A4 인쇄] 미리보기와 동일한 결과를 Drive에 저장하기 위해 사용한다.
 *
 * - 숨겨진 iframe에 HTML을 렌더링(스크립트 제거, 인쇄 안내 툴바 숨김)
 * - html2canvas로 캡처한 뒤 A4(여백 10mm) 페이지로 분할
 * - 페이지 경계는 표의 행/섹션 경계에 맞춰 행이 반으로 잘리지 않도록 한다
 */

const MM_PER_PX = 25.4 / 96;
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_MM = 10;
const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2; // 190mm
const CONTENT_H_MM = PAGE_H_MM - MARGIN_MM * 2; // 277mm
const CONTENT_W_PX = Math.round(CONTENT_W_MM / MM_PER_PX); // ≈ 718px

const CAPTURE_OVERRIDE_CSS = `
  html, body { margin: 0 !important; background: #ffffff !important; }
  html { padding: 0 !important; }
  /* 표 오른쪽 테두리가 캡처 경계에서 잘리지 않도록 좌우 여유 (foreignObject 캡처 시 약 2px 우측 이동 보정) */
  body { padding: 0 4px !important; box-sizing: border-box !important; }
  .no-print, .no-print-toolbar { display: none !important; }
`;

/** 페이지를 나눌 수 있는 경계(행·섹션의 하단) 후보 선택자 */
const BREAK_CANDIDATE_SELECTOR =
  'tr, h1, h2, h3, p, li, .section-title, .guide-box, .footer-note, .header-box, table, .page-break-point';

function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '');
}

async function waitForAssets(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  await Promise.all(
    images.map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
    )
  );
  try {
    await (doc as any).fonts?.ready;
  } catch {
    // ignore
  }
}

function collectBreakPoints(doc: Document): number[] {
  const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop || 0;
  const points = new Set<number>();
  doc.querySelectorAll(BREAK_CANDIDATE_SELECTOR).forEach(el => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    if (rect.height <= 0) return;
    points.add(Math.round(rect.bottom + scrollTop));
    points.add(Math.round(rect.top + scrollTop));
  });
  return Array.from(points).sort((a, b) => a - b);
}

/** 캔버스를 내보낼 수 있고(오염 안 됨) 실제로 그려진 내용이 있는지 확인 */
function isUsableCanvas(canvas: HTMLCanvasElement): boolean {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    // 상단 영역(머리말·결재란)에 흰색이 아닌 픽셀이 있는지 확인
    const h = Math.min(canvas.height, 400);
    const data = ctx.getImageData(0, 0, canvas.width, h).data;
    for (let i = 0; i < data.length; i += 4 * 7) {
      if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) return true;
    }
    return false;
  } catch {
    return false; // tainted canvas
  }
}

/**
 * 콘텐츠 높이(px)를 페이지 높이 단위로 나누되, 가능한 한 행/섹션 경계에서 자른다.
 */
function computePageSlices(totalHeightPx: number, pageHeightPx: number, breakPoints: number[]): Array<[number, number]> {
  const slices: Array<[number, number]> = [];
  let start = 0;
  while (start < totalHeightPx - 1) {
    const limit = start + pageHeightPx;
    if (limit >= totalHeightPx) {
      slices.push([start, totalHeightPx]);
      break;
    }
    // 페이지 하단 40% 구간 안에서 가장 아래쪽 경계를 선택
    const minEnd = start + pageHeightPx * 0.6;
    let end = -1;
    for (const p of breakPoints) {
      if (p > minEnd && p <= limit) end = p;
      if (p > limit) break;
    }
    if (end <= start) end = limit; // 적절한 경계가 없으면(매우 긴 행 등) 페이지 높이에서 자름
    slices.push([start, end]);
    start = end;
  }
  return slices;
}

export interface A4PdfRenderOptions {
  /** 캡처 배율 (기본 2: 인쇄 품질) */
  scale?: number;
  /** JPEG 품질 (기본 0.92) */
  quality?: number;
}

/**
 * A4 인쇄용 HTML 문자열을 PDF로 렌더링하여 base64 문자열(헤더 제외)로 반환한다.
 */
export async function renderA4HtmlToPdfBase64(html: string, options: A4PdfRenderOptions = {}): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('A4 PDF 렌더링은 브라우저에서만 실행할 수 있습니다.');
  }
  const scale = options.scale ?? 2;
  const quality = options.quality ?? 0.92;

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${CONTENT_W_PX}px`,
    height: '1200px',
    border: '0',
    pointerEvents: 'none',
  } as CSSStyleDeclaration);
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('PDF 렌더링용 문서를 만들 수 없습니다.');
    doc.open();
    doc.write(stripScripts(html));
    doc.close();

    const style = doc.createElement('style');
    style.textContent = CAPTURE_OVERRIDE_CSS;
    doc.head.appendChild(style);

    await waitForAssets(doc);

    // iframe 자체 높이가 문서 높이로 잡히지 않도록 최소 높이로 줄인 뒤 실제 콘텐츠 높이를 잰다
    iframe.style.height = '1px';
    await new Promise(r => setTimeout(r, 30));
    const totalHeight = Math.ceil(
      Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, doc.body.offsetHeight)
    );
    iframe.style.height = `${totalHeight}px`;
    // 레이아웃 반영 대기
    await new Promise(r => setTimeout(r, 50));

    const breakPoints = collectBreakPoints(doc);
    const baseOptions = {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: CONTENT_W_PX,
      height: totalHeight,
      windowWidth: CONTENT_W_PX,
      windowHeight: totalHeight,
    };
    // 1순위: foreignObject 렌더링 — 브라우저가 직접 그린 결과라 글자 위치가 화면과 동일하다.
    //   (기본 캔버스 렌더러는 한글 글꼴에서 글자를 몇 px 아래로 그려 결재칸 테두리와 겹친다)
    // 실패하거나 빈 캔버스·오염(tainted) 캔버스가 나오면 기본 렌더러로 대체한다.
    let canvas: HTMLCanvasElement | null = null;
    try {
      const fo = await html2canvas(doc.body, { ...baseOptions, foreignObjectRendering: true });
      if (isUsableCanvas(fo)) canvas = fo;
    } catch (e) {
      console.warn('[a4HtmlPdfRenderer] foreignObject 렌더링 실패, 기본 렌더러로 대체:', e);
    }
    if (!canvas) {
      canvas = await html2canvas(doc.body, { ...baseOptions, allowTaint: true });
    }

    const pxPerCanvas = canvas.width / CONTENT_W_PX; // = scale
    const pageHeightPx = CONTENT_H_MM / MM_PER_PX; // CSS px 기준 한 페이지 높이
    const slices = computePageSlices(totalHeight, pageHeightPx, breakPoints);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    slices.forEach(([startPx, endPx], idx) => {
      const sliceHeightPx = Math.max(1, endPx - startPx);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.round(sliceHeightPx * pxPerCanvas);
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        Math.round(startPx * pxPerCanvas),
        canvas.width,
        pageCanvas.height,
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );
      if (idx > 0) pdf.addPage('a4', 'portrait');
      const img = pageCanvas.toDataURL('image/jpeg', quality);
      pdf.addImage(img, 'JPEG', MARGIN_MM, MARGIN_MM, CONTENT_W_MM, sliceHeightPx * MM_PER_PX, undefined, 'FAST');
    });

    const dataUri = pdf.output('datauristring');
    return dataUri.slice(dataUri.indexOf(',') + 1);
  } finally {
    iframe.remove();
  }
}
