import type { drive_v3 } from 'googleapis';

/**
 * PDF 변환용 임시 Google 문서를 정리한다.
 *
 * 공유 드라이브에서 서비스 계정은 보통 '콘텐츠 관리자' 권한이라 영구 삭제(files.delete)가 거부되고
 * 휴지통 이동(trashed=true)만 허용된다. 그래서 휴지통 이동을 먼저 시도하고(30일 후 자동 영구 삭제),
 * 실패하면 영구 삭제를 시도한다. 둘 다 실패해도 본 작업은 계속되도록 경고만 남긴다.
 */
export async function discardDriveTempFile(
  drive: drive_v3.Drive,
  fileId: string | null | undefined,
  logPrefix = '[driveTempCleanup]'
): Promise<boolean> {
  if (!fileId) return false;
  try {
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    });
    return true;
  } catch (trashErr) {
    try {
      await drive.files.delete({ fileId, supportsAllDrives: true });
      return true;
    } catch (deleteErr) {
      console.warn(`${logPrefix} 임시 문서 정리 실패 (fileId=${fileId}):`, deleteErr || trashErr);
      return false;
    }
  }
}
