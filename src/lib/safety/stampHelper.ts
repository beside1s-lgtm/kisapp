/**
 * 교원 도장 및 서명 이미지 헬퍼
 * - 프로필에 등록된 서명 이미지(base64)가 있으면 우선 사용
 * - 등록된 서명이 없는 경우, 교사 성명 기반 붉은색 타원형 직인(도장) 인영 SVG Data URL을 동적으로 생성
 */

export function generateStampSvgDataUrl(name: string): string {
  const cleanName = (name || '교사').trim().slice(0, 4);
  
  // 붉은색 인주 색상
  const stampColor = '#d32f2f';

  // 한국식 타원형 도장 SVG
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 65" width="100" height="65">
  <!-- 외곽 붉은색 타원 테두리 (약간의 인주 번짐과 빈티지한 느낌) -->
  <ellipse cx="50" cy="32.5" rx="46" ry="28" fill="none" stroke="${stampColor}" stroke-width="3" opacity="0.9" />
  <ellipse cx="50" cy="32.5" rx="43" ry="25" fill="none" stroke="${stampColor}" stroke-width="1" opacity="0.6" />
  
  <!-- 도장 텍스트: 교사 이름 + 印 -->
  <text 
    x="50" 
    y="39" 
    font-family="'Batang', 'Noto Serif KR', '궁서', 'Gungsuh', serif" 
    font-size="20" 
    font-weight="900" 
    fill="${stampColor}" 
    text-anchor="middle"
    letter-spacing="2"
    opacity="0.95"
  >
    ${cleanName}
  </text>
</svg>
  `.trim();

  // utf8 safe base64
  const base64 = typeof window !== 'undefined'
    ? window.btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg).toString('base64');

  return `data:image/svg+xml;base64,${base64}`;
}

// 초기 프로필 저장이나 캔버스 미작성 시 주입되는 100x50 완전 투명 빈 더미 PNG 데이터
export const DUMMY_TRANSPARENT_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACAnNXFAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA0SURBVHhe7cExAQAAAMKg9U9tDC8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADA3DVAAAYs42c0AAAAASUVORK5CYII=';

/**
 * 사용자가 직접 업로드하거나 서명 패드로 그린 실제 유의미한 서명/도장 이미지인지 판별
 * - 타원형 가상 SVG 인영 제외
 * - 투명한 빈 캔버스 더미 PNG (234자) 및 300자 미만의 무내용 데이터 제외
 * - PNG/JPG Base64 실제 이미지(유의미한 바이트 크기) 또는 Storage HTTP(S) URL인 경우만 true
 */
export function isActualSignature(sig?: string | null): boolean {
  if (!sig || typeof sig !== 'string') return false;
  const trimmed = sig.trim();
  if (!trimmed) return false;

  // 1. 더미 투명 빈 PNG 제외
  if (trimmed === DUMMY_TRANSPARENT_PNG || trimmed.includes('AGQAAAAyCAYAAACAnNXFA')) {
    return false;
  }

  // 2. 타원형 가상 도장 SVG 제외
  if (trimmed.startsWith('data:image/svg+xml') && (trimmed.includes('ellipse') || trimmed.includes('<svg') || trimmed.includes('xmlns'))) {
    return false;
  }

  // 3. Base64 이미지 데이터 검증: 실제 그림이나 도장 파일은 수천~수만 자이므로 300자 미만 빈 캔버스는 제외
  if (trimmed.startsWith('data:image/')) {
    if (trimmed.length < 300) {
      return false;
    }
    return true;
  }

  // 4. Firebase Storage 등 실제 외부 이미지 URL
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

/**
 * 교사의 최종 도장/서명 이미지 Data URL 반환
 */
export function getTeacherStampSignature(teacherName: string, profileSignature?: string | null): string {
  // 사용자가 직접 등록한 실제 도장/서명 이미지인 경우 우선 반환
  if (isActualSignature(profileSignature)) {
    return profileSignature!;
  }
  // 없으면 성명 기반 붉은색 타원형 직인 인영 자동 생성
  return generateStampSvgDataUrl(teacherName);
}
