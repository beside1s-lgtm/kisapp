/**
 * 대한민국 행정업무 표준 및 경기도교육청 공문서 작성법 매뉴얼 기반
 * 공문서 본문 HTML 뷰어 및 PDF 인쇄 렌더링 서식 정제 엔진
 */

export function formatOfficialDocumentHtml(html: string): string {
  if (!html) return '';

  let processed = html.trim();

  // 1. 단순 텍스트(\n 포함)만 들어온 경우 기본 p 태그 래핑
  if (!processed.includes('<p') && !processed.includes('<div') && !processed.includes('<ol') && !processed.includes('<ul') && !processed.includes('<table')) {
    const lines = processed.split('\n');
    processed = lines.map(line => `<p>${line || '&nbsp;'}</p>`).join('');
  }

  // 2. <ol>, <ul>, <table>, <blockquote> 등 컨테이너 태그는 보존하고, <p> 태그에 공문서 표준 스타일 적용
  // DOM 파싱 대신 안전한 정규식으로 <ol>, <ul>, <table>에 공문서 표준 CSS 주입
  processed = processed
    .replace(/<ol(\s*[^>]*)>/gi, (_, attrs) => {
      return `<ol style="list-style-type: decimal !important; padding-left: 24px; margin: 8px 0; line-height: 1.8;">`;
    })
    .replace(/<ul(\s*[^>]*)>/gi, (_, attrs) => {
      return `<ul style="list-style-type: disc !important; padding-left: 24px; margin: 8px 0; line-height: 1.8;">`;
    })
    .replace(/<li(\s*[^>]*)>/gi, (_, attrs) => {
      return `<li style="margin-bottom: 4px; line-height: 1.8; word-break: keep-all;">`;
    })
    .replace(/<table(\s*[^>]*)>/gi, (_, attrs) => {
      return `<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11pt;" border="1">`;
    })
    .replace(/<th(\s*[^>]*)>/gi, (_, attrs) => {
      return `<th style="border: 1px solid #334155; padding: 6px 8px; background-color: #f1f5f9; font-weight: 700; text-align: center;">`;
    })
    .replace(/<td(\s*[^>]*)>/gi, (_, attrs) => {
      return `<td style="border: 1px solid #334155; padding: 6px 8px; text-align: center;">`;
    });

  // 3. <p> 태그 항목별 공문서 표준 들여쓰기 계산
  // <p>...</p> 블록 매칭
  let isInsideAttachmentSection = false;

  processed = processed.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (fullMatch, attrs, innerContent) => {
    // 텍스트 내용 추출
    const textContent = innerContent.replace(/<[^>]*>/g, '').trim();

    let marginLeft = '0px';
    let marginTop = '0px';
    let marginBottom = '6px';

    if (textContent) {
      // A. 붙임 첫째 줄 (붙임  1. ...)
      if (/^붙임\s*/.test(textContent)) {
        isInsideAttachmentSection = true;
        marginTop = '18px'; // 본문과 붙임 사이 간격
        marginLeft = '0px';
      } 
      // B. 붙임 둘째 줄 이하 (2. ..., 3. ...)
      else if (isInsideAttachmentSection && /^[2-9]\.\s*/.test(textContent)) {
        marginLeft = '54px'; // 붙임 1.의 번호 위치 직하 정렬
      }
      // C. 둘째 항목 기호 (가., 나., 다., 라...)
      else if (/^[가-하]\.\s*/.test(textContent)) {
        isInsideAttachmentSection = false;
        marginLeft = '18px'; // 오른쪽으로 2타 이동
      }
      // D. 셋째 항목 기호 (1), 2), 3), 4)...)
      else if (/^\d+\)\s*/.test(textContent)) {
        isInsideAttachmentSection = false;
        marginLeft = '36px'; // 오른쪽으로 4타 이동
      }
      // E. 넷째 항목 기호 ((가), (나), (다)...)
      else if (/^\([가-하]\)\s*/.test(textContent)) {
        isInsideAttachmentSection = false;
        marginLeft = '54px';
      }
      // F. 다섯째 항목 기호 ((1), (2), (3)...)
      else if (/^\(\d+\)\s*/.test(textContent)) {
        isInsideAttachmentSection = false;
        marginLeft = '72px';
      }
      // G. 첫째 항목 기호 (1., 2., 3....)
      else if (/^\d+\.\s*/.test(textContent)) {
        isInsideAttachmentSection = false;
        marginLeft = '0px';
      }
    }

    // 기존 style 속성이 있으면 margin-left와 line-height 등을 병합
    let cleanAttrs = attrs || '';
    if (/style=["'][^"']*["']/i.test(cleanAttrs)) {
      cleanAttrs = cleanAttrs.replace(/style=["']([^"']*)["']/i, (_: string, styleContent: string) => {
        let clean = styleContent
          .replace(/margin-left\s*:\s*[^;]+;?/gi, '')
          .replace(/margin-top\s*:\s*[^;]+;?/gi, '')
          .replace(/margin-bottom\s*:\s*[^;]+;?/gi, '')
          .replace(/line-height\s*:\s*[^;]+;?/gi, '')
          .replace(/word-break\s*:\s*[^;]+;?/gi, '');
        return `style="${clean}; margin-left: ${marginLeft}; margin-top: ${marginTop}; margin-bottom: ${marginBottom}; line-height: 1.8; word-break: keep-all;"`;
      });
    } else {
      cleanAttrs += ` style="margin-left: ${marginLeft}; margin-top: ${marginTop}; margin-bottom: ${marginBottom}; line-height: 1.8; word-break: keep-all;"`;
    }

    return `<p${cleanAttrs}>${innerContent}</p>`;
  });

  return processed;
}
