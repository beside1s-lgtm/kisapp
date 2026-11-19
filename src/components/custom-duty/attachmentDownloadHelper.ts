import type { Attachment } from '@/lib/types';

export async function downloadAttachmentSafely(att: Attachment): Promise<void> {
  if (!att?.data) {
    throw new Error('다운로드할 수 있는 파일 데이터가 없습니다.');
  }

  if (att.data.startsWith('data:')) {
    const res = await fetch(att.data);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = att.name || 'attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    return;
  }

  const link = document.createElement('a');
  link.href = att.data;
  link.download = att.name || 'attachment';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function formatAttachmentSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
