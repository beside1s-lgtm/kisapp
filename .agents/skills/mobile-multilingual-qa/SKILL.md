---
name: mobile-multilingual-qa
description: 학부모 및 교원 모바일 화면에서 베트남어, 영어, 한국어 다국어 전환 시 텍스트 찌그러짐, 버튼 겹침, 가로 오버플로우를 검증할 때 사용
---

# 다국어 모바일 반응형 자동 검증 워크플로우

## 1. 뷰포트 및 디바이스 에뮬레이션
- `Puppeteer` 또는 `Chrome DevTools` MCP를 호출하여 모바일 뷰포트를 설정한다.
  - 소형 모바일: 360x740
  - 표준 모바일: 375x812 (또는 390x844)

## 2. 다국어 순차 전환 테스트
- `localStorage.setItem('language', lang)`을 설정하고 페이지를 새로고침한다.
  1. 한국어 (`ko`)
  2. 베트남어 (`vi`): 단어 길이가 길어 레이아웃 붕괴가 가장 빈번하므로 집중 점검
  3. 영어 (`en`)

## 3. 가로 오버플로우 자동 스캔
- 페이지 렌더링 후 스크립트를 실행하여 화면 밖으로 삐져나온 요소를 탐색한다:
  ```javascript
  const docWidth = document.documentElement.clientWidth;
  const offenders = [];
  document.querySelectorAll('*').forEach(el => {
    if (el.offsetWidth > 0 && el.scrollWidth > docWidth + 2) {
      offenders.push({ tag: el.tagName, class: el.className, scrollWidth: el.scrollWidth, docWidth });
    }
  });
  ```
- `offenders.length === 0` 및 `document.documentElement.scrollWidth <= docWidth`를 확인한다.

## 4. 텍스트 세로 찌그러짐 및 Flexbox 검증
- 텍스트 컨테이너가 한 글자씩 떨어지지 않는지 확인한다.
- `min-w-0` 단독 사용 여부를 점검하고 필요 시 `min-w-[180px]` 이상이 적용되었는지 확인한다.
- 긴 어절이 온전히 표시되도록 `break-normal`이 적용되었는지 확인한다.

## 5. 스크린샷 캡처 및 최종 보고
- `puppeteer_screenshot` 또는 `take_screenshot`으로 렌더링 결과 이미지를 저장하여 시각적으로 검증한 뒤 사용자에게 보고한다.
