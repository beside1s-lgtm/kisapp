/**
 * 클라이언트 단 이미지 리사이징 및 용량 자동 최적화 유틸
 */

export interface OptimizeResult {
  dataUrl: string;
  originalSize: string;
  optimizedSize: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * 서명/도장 이미지(파일 또는 Base64 문자열)를 종횡비 유지 리사이즈 및 투명 PNG로 자동 최적화
 * - 가로 최대 280px, 세로 최대 140px
 * - 용량을 수십 KB(보통 10~30KB) 수준으로 초경량화하여 Firestore 1MB 제한 및 깨짐 원천 방지
 */
export async function optimizeSignatureImage(
  input: File | string,
  maxWidth: number = 280,
  maxHeight: number = 140
): Promise<OptimizeResult> {
  return new Promise((resolve, reject) => {
    const processImage = (srcUrl: string, originalBytes: number) => {
      const img = new Image();

      img.onload = () => {
        try {
          let { width, height } = img;
          if (!width || !height) {
            resolve({
              dataUrl: srcUrl,
              originalSize: formatBytes(originalBytes),
              optimizedSize: formatBytes(originalBytes),
            });
            return;
          }

          // 종횡비 유지 (Contain)
          const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
          const targetW = Math.max(1, Math.round(width * ratio));
          const targetH = Math.max(1, Math.round(height * ratio));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              dataUrl: srcUrl,
              originalSize: formatBytes(originalBytes),
              optimizedSize: formatBytes(originalBytes),
            });
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);

          // 투명 배경 유지를 위해 image/png 출력
          const dataUrl = canvas.toDataURL('image/png');
          const optimizedBytes = Math.round((dataUrl.length - 'data:image/png;base64,'.length) * 0.75);

          resolve({
            dataUrl,
            originalSize: formatBytes(originalBytes),
            optimizedSize: formatBytes(optimizedBytes),
          });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('서명 이미지를 불러오는데 실패했습니다.'));
      };

      img.src = srcUrl;
    };

    if (typeof input === 'string') {
      const bytes = Math.round((input.length - 22) * 0.75);
      processImage(input, bytes);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        processImage(e.target?.result as string, input.size);
      };
      reader.onerror = () => reject(new Error('서명 파일을 읽는데 실패했습니다.'));
      reader.readAsDataURL(input);
    }
  });
}

export async function optimizeStudentPhoto(
  file: File,
  targetSize: number = 280,
  quality: number = 0.85
): Promise<OptimizeResult> {
  const originalBytes = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context를 생성할 수 없습니다.'));
            return;
          }

          // 고품질 이미지 렌더링 옵션
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // 1:1 정사각형 중앙 크롭 (Center Crop) 계산
          const minEdge = Math.min(img.width, img.height);
          const cropX = (img.width - minEdge) / 2;
          const cropY = (img.height - minEdge) / 2;

          // 캔버스에 그리기
          ctx.drawImage(
            img,
            cropX,
            cropY,
            minEdge,
            minEdge,
            0,
            0,
            targetSize,
            targetSize
          );

          // JPEG 압축 (0.85 퀄리티로 가볍고 선명하게)
          const dataUrl = canvas.toDataURL('image/jpeg', quality);

          // 최적화된 바이트 수 추정 (Base64 길이 * 0.75)
          const optimizedBytes = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);

          resolve({
            dataUrl,
            originalSize: formatBytes(originalBytes),
            optimizedSize: formatBytes(optimizedBytes),
          });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('이미지를 불러오는데 실패했습니다.'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽는데 실패했습니다.'));
    };

    reader.readAsDataURL(file);
  });
}
