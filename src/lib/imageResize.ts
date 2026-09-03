/**
 * 학생 사진을 가로세로 2cm 최적 해상도(160x160px)로 리사이징 및 압축 변환
 * - 가로세로 2cm (96 DPI 기준 약 76px, 2x 고해상도 선명도 지원 160px)
 * - 1:1 정방형 중앙 크롭 (Center crop)
 * - 고효율 압축(품질 82%)을 적용하여 용량을 5~12KB 수준으로 절감
 */
export async function resizeStudentPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일(JPG, PNG, WebP 등)만 등록할 수 있습니다.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetSize = 160; // 2cm 기준 최적 해상도 (76px의 2배수 고화질)
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('캔버스 그래픽 처리를 지원하지 않는 브라우저입니다.'));
          return;
        }

        // 1:1 정사각형 중앙 크롭 영역 계산
        const srcW = img.width;
        const srcH = img.height;
        const minDim = Math.min(srcW, srcH);
        const srcX = (srcW - minDim) / 2;
        const srcY = (srcH - minDim) / 2;

        // 고품질 보간 설정
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 캔버스에 그리기
        ctx.drawImage(img, srcX, srcY, minDim, minDim, 0, 0, targetSize, targetSize);

        // JPEG 0.82 품질로 인코딩 (약 5~12KB)
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(optimizedDataUrl);
      };
      img.onerror = () => reject(new Error('이미지를 불러오는 데 실패했습니다.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('파일을 읽는 데 실패했습니다.'));
    reader.readAsDataURL(file);
  });
}
