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
  // 붙임 전용 표(attachment-table)는 선 없는 표(border: none)로 보존하고 일반 표만 테두리 적용
  processed = processed
    .replace(/<ol(\s*[^>]*)>/gi, () => `<ol style="list-style-type: decimal !important; padding-left: 24px; margin: 8px 0; line-height: 1.8;">`)
    .replace(/<ul(\s*[^>]*)>/gi, () => `<ul style="list-style-type: disc !important; padding-left: 24px; margin: 8px 0; line-height: 1.8;">`)
    .replace(/<li(\s*[^>]*)>/gi, () => `<li style="margin-bottom: 4px; line-height: 1.8; word-break: keep-all;">`)
    .replace(/<table(\s*[^>]*)>/gi, (match, attrs) => {
      if (attrs.includes('attachment-table') || attrs.includes('border: none') || attrs.includes('border: 0') || attrs.includes('border="0"')) {
        return `<table style="width: 100%; border-collapse: collapse; border: none; margin: 16px 0 6px 0; line-height: 1.8; font-size: inherit;" class="attachment-table">`;
      }
      return `<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11pt;" border="1">`;
    })
    .replace(/<th(\s*[^>]*)>/gi, (match, attrs) => {
      if (attrs.includes('border: none') || attrs.includes('border: 0')) return match;
      return `<th style="border: 1px solid #334155; padding: 6px 8px; background-color: #f1f5f9; font-weight: 700; text-align: center;">`;
    })
    .replace(/<td(\s*[^>]*)>/gi, (match, attrs) => {
      if (attrs.includes('border: none') || attrs.includes('border: 0')) return match;
      return `<td style="border: 1px solid #334155; padding: 6px 8px; text-align: center;">`;
    });

  // 3. <p> 태그 항목별 공문서 표준 들여쓰기 계산 및 붙임 항목의 '선 없는 표' 자동 구조화
  // 연속된 붙임 <p> 태그들을 추출하여 선 없는 2열 테이블(1열: 붙임, 2열: 1. / 2.)로 변환
  const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
  const pList: { full: string; attrs: string; inner: string; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(processed)) !== null) {
    const inner = m[2];
    const text = inner.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').trim();
    pList.push({ full: m[0], attrs: m[1], inner, text });
  }

  // 본문 내 붙임 p 태그들을 찾아서 선 없는 표로 일괄 치환
  let attachmentItems: { isFirst: boolean; content: string }[] = [];
  let attachmentStartIndex = -1;

  for (let i = 0; i < pList.length; i++) {
    const item = pList[i];
    if (/^붙임\s*/.test(item.text)) {
      attachmentStartIndex = i;
      // '붙임' 텍스트 뒤에 오는 1. ... 내용 추출
      const cleanContent = item.inner.replace(/<[^>]*>/g, '').replace(/^붙임\s*/, '').replace(/^(&nbsp;|\s|\u00a0)+/, '').trim();
      attachmentItems.push({ isFirst: true, content: cleanContent });
    } else if (attachmentStartIndex !== -1 && (/^[2-9]\.\s*/.test(item.text) || /^끝\./.test(item.text))) {
      const cleanContent = item.inner.replace(/<[^>]*>/g, '').replace(/^(&nbsp;|\s|\u00a0)+/, '').trim();
      attachmentItems.push({ isFirst: false, content: cleanContent });
    } else if (attachmentStartIndex !== -1) {
      break;
    }
  }

  if (attachmentItems.length > 0 && attachmentStartIndex !== -1) {
    const tableRows = attachmentItems.map((att, idx) => `
      <tr>
        <td style="vertical-align: top; width: 36px; border: none; padding: 0 8px 3px 0; white-space: nowrap; font-weight: normal; color: inherit;">${att.isFirst ? '붙임' : ''}</td>
        <td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal; color: inherit; word-break: keep-all;">${att.content}</td>
      </tr>
    `).join('');

    const attachmentTableHtml = `
      <table style="width: 100%; border-collapse: collapse; border: none; margin-top: 18px; margin-bottom: 6px; line-height: 1.8; font-size: inherit;" class="attachment-table">
        <tbody>${tableRows}</tbody>
      </table>
    `.trim();

    // 해당 p 태그들을 attachmentTableHtml 로 치환
    const toReplace = pList.slice(attachmentStartIndex, attachmentStartIndex + attachmentItems.length).map(p => p.full).join('');
    // processed 에서 해당 영역을 attachmentTableHtml 로 변경
    if (toReplace && processed.includes(toReplace)) {
      processed = processed.replace(toReplace, attachmentTableHtml);
    } else {
      // 분산되어 있을 경우 개별 치환
      pList.slice(attachmentStartIndex, attachmentStartIndex + attachmentItems.length).forEach((p, idx) => {
        if (idx === 0) {
          processed = processed.replace(p.full, attachmentTableHtml);
        } else {
          processed = processed.replace(p.full, '');
        }
      });
    }
  }

  // 4. 나머지 <p> 태그에 일반 공문서 들여쓰기 적용
  processed = processed.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (fullMatch, attrs, innerContent) => {
    const textContent = innerContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').trim();

    let marginLeft = '0px';
    let marginTop = '0px';
    let marginBottom = '6px';

    if (textContent) {
      // 둘째 항목 기호 (가., 나., 다., 라...)
      if (/^[가-하]\.\s*/.test(textContent)) {
        marginLeft = '18px';
      }
      // 셋째 항목 기호 (1), 2), 3), 4)...)
      else if (/^\d+\)\s*/.test(textContent)) {
        marginLeft = '36px';
      }
      // 넷째 항목 기호 ((가), (나), (다)...)
      else if (/^\([가-하]\)\s*/.test(textContent)) {
        marginLeft = '54px';
      }
      // 다섯째 항목 기호 ((1), (2), (3)...)
      else if (/^\(\d+\)\s*/.test(textContent)) {
        marginLeft = '72px';
      }
      // 첫째 항목 기호 (1., 2., 3....)
      else if (/^\d+\.\s*/.test(textContent)) {
        marginLeft = '0px';
      }
    }

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
