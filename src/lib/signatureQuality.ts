/**
 * 손으로 그린 서명이 도장 자리에 쓸 만한지 점검
 * - 한 획(세로줄·가로줄)이나 점처럼 너무 작게 그려진 서명은 출근부·출석부에 "|"처럼 보이므로 다시 그리게 한다.
 * - 그림의 실제 잉크 영역(투명·흰색이 아닌 픽셀)의 가로·세로 크기로 판단한다.
 */
const MIN_INK_WIDTH = 40; // px (이미지 기준)
const MIN_INK_HEIGHT = 15; // px

export async function checkDrawnSignature(dataUrl: string): Promise<string | null> {
  if (typeof window === 'undefined' || !dataUrl) return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return '서명 그림을 읽지 못했습니다. 다시 그려 주세요.';
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = data[i + 3];
        const isInk = a > 40 && (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200);
        if (!isInk) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return '서명이 비어 있습니다. 서명을 그려 주세요.';
    const inkW = maxX - minX + 1;
    const inkH = maxY - minY + 1;
    if (inkW < MIN_INK_WIDTH || inkH < MIN_INK_HEIGHT) {
      return '서명이 한 획(선) 또는 점처럼 너무 작게 그려졌습니다. 이름이 알아볼 수 있도록 서명란에 크게 다시 그려 주세요.';
    }
    return null;
  } catch {
    return null; // 점검 실패 시 저장은 막지 않는다
  }
}
