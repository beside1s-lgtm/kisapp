export type GoogleDriveItemType = 'doc' | 'sheet' | 'slide' | 'pdf' | 'folder' | 'file';

export interface ParsedGoogleDriveLink {
  isValid: boolean;
  fileId?: string;
  fileType: GoogleDriveItemType;
  viewUrl: string;
  suggestedName?: string;
}

/**
 * Google Drive / Docs / Sheets / Slides URL을 파싱하여 메타데이터 추출
 */
export function parseGoogleDriveUrl(rawUrl: string): ParsedGoogleDriveLink {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isValid: false, fileType: 'file', viewUrl: '' };
  }

  // 1. Google Sheets
  const sheetsMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  if (sheetsMatch) {
    return {
      isValid: true,
      fileId: sheetsMatch[1],
      fileType: 'sheet',
      viewUrl: `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/edit?usp=sharing`,
      suggestedName: 'Google 스프레드시트'
    };
  }

  // 2. Google Docs
  const docsMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9-_]+)/i);
  if (docsMatch) {
    return {
      isValid: true,
      fileId: docsMatch[1],
      fileType: 'doc',
      viewUrl: `https://docs.google.com/document/d/${docsMatch[1]}/edit?usp=sharing`,
      suggestedName: 'Google 문서'
    };
  }

  // 3. Google Slides
  const slidesMatch = trimmed.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/i);
  if (slidesMatch) {
    return {
      isValid: true,
      fileId: slidesMatch[1],
      fileType: 'slide',
      viewUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/edit?usp=sharing`,
      suggestedName: 'Google 프레젠테이션'
    };
  }

  // 4. Google Drive Folder
  const folderMatch = trimmed.match(/\/drive(?:\/u\/\d+)?\/folders\/([a-zA-Z0-9-_]+)/i);
  if (folderMatch) {
    return {
      isValid: true,
      fileId: folderMatch[1],
      fileType: 'folder',
      viewUrl: `https://drive.google.com/drive/folders/${folderMatch[1]}`,
      suggestedName: 'Google Drive 폴더'
    };
  }

  // 5. Google Drive File
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9-_]+)/i);
  if (fileMatch) {
    const isPdf = trimmed.toLowerCase().includes('.pdf');
    return {
      isValid: true,
      fileId: fileMatch[1],
      fileType: isPdf ? 'pdf' : 'file',
      viewUrl: `https://drive.google.com/file/d/${fileMatch[1]}/view?usp=sharing`,
      suggestedName: isPdf ? 'Google Drive PDF 문서' : 'Google Drive 파일'
    };
  }

  // 6. Generic drive.google.com / docs.google.com fallback
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    return {
      isValid: true,
      fileType: 'file',
      viewUrl: trimmed,
      suggestedName: 'Google Drive 항목'
    };
  }

  return { isValid: false, fileType: 'file', viewUrl: trimmed };
}

/**
 * 폴더 URL 또는 문자열에서 순수 Folder ID만 추출
 */
export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/i);
  if (folderMatch) return folderMatch[1];
  // 이미 ID 형태인 경우
  if (/^[a-zA-Z0-9-_]{15,}$/.test(trimmed)) return trimmed;
  return trimmed;
}

/**
 * 구글 드라이브 항목 타입별 뱃지 스타일 및 라벨 정보
 */
export function getDriveTypeInfo(type?: GoogleDriveItemType) {
  switch (type) {
    case 'sheet':
      return {
        label: 'Google Sheet',
        bgColor: 'bg-emerald-100',
        textColor: 'text-emerald-800',
        borderColor: 'border-emerald-300',
        badgeColor: 'bg-emerald-600 text-white'
      };
    case 'doc':
      return {
        label: 'Google Doc',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-300',
        badgeColor: 'bg-blue-600 text-white'
      };
    case 'slide':
      return {
        label: 'Google Slide',
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-800',
        borderColor: 'border-amber-300',
        badgeColor: 'bg-amber-600 text-white'
      };
    case 'folder':
      return {
        label: 'Drive Folder',
        bgColor: 'bg-indigo-100',
        textColor: 'text-indigo-800',
        borderColor: 'border-indigo-300',
        badgeColor: 'bg-indigo-600 text-white'
      };
    case 'pdf':
      return {
        label: 'Drive PDF',
        bgColor: 'bg-rose-100',
        textColor: 'text-rose-800',
        borderColor: 'border-rose-300',
        badgeColor: 'bg-rose-600 text-white'
      };
    default:
      return {
        label: 'Google Drive',
        bgColor: 'bg-slate-100',
        textColor: 'text-slate-800',
        borderColor: 'border-slate-300',
        badgeColor: 'bg-slate-600 text-white'
      };
  }
}
