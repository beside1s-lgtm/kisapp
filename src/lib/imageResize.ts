import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

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

/**
 * 소견서 / 진단서 / 처방전 사진을 문서용 최적 해상도(최대 1200px)로 압축 변환
 * - 비율 유지 (Aspect ratio 보존)
 * - 원본 5~10MB 사진을 100~200KB 수준으로 경량화하여 Firestore 및 PDF 출력 최적화
 */
export async function compressCertificateImage(file: File, maxDimension: number = 1200): Promise<string> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  
  // PDF이거나 600KB 이상인 대용량 파일은 Firebase Storage에 업로드하여 다운로드 URL 발급 (Firestore 1MB 한도 방지)
  if (isPdf || file.size > 600 * 1024) {
    try {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileRef = ref(storage, `attachments/certificates/${Date.now()}_${safeFileName}`);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      return downloadUrl;
    } catch (storageErr) {
      console.warn('Firebase Storage upload failed, falling back to local data URL:', storageErr);
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('파일 용량은 최대 50MB 이하로 첨부해 주세요.');
      }
    }
  }

  return new Promise((resolve, reject) => {
    // PDF 파일 처리
    if (isPdf) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('PDF 파일을 읽지 못했습니다.'));
      reader.readAsDataURL(file);
      return;
    }

    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일(JPG, PNG, WebP 등) 또는 PDF 파일만 업로드할 수 있습니다.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('캔버스 처리를 지원하지 않는 환경입니다.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

/**
 * 소견서 / 진단서 / 처방전 사진 및 PDF 파일을 업로드 및 처리
 * - Firebase Storage 업로드 우선 (최대 50MB) -> HTTPS 다운로드 URL 반환
 * - Firestore 1MB 단일 문서 제한을 100% 회피하고 구글 드라이브 완결본에 원본 보존
 */
export async function uploadCertificateAttachment(file: File): Promise<{ url: string; size: number }> {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('파일 용량은 최대 50MB까지 첨부할 수 있습니다.');
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  
  try {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileRef = ref(storage, `attachments/certificates/${Date.now()}_${safeFileName}`);
    await uploadBytes(fileRef, file);
    const downloadUrl = await getDownloadURL(fileRef);
    return { url: downloadUrl, size: file.size };
  } catch (storageErr) {
    console.warn('Storage direct upload failed, trying image compression/DataURL:', storageErr);
    const dataUrl = await compressCertificateImage(file);
    return { url: dataUrl, size: file.size };
  }
}

