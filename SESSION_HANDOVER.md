# KISAPP Development Session Handover

## 1. Current Status (현재 상태)
- **단순 확인 완료형 의견 첨부(선택) 기능 및 업무 해결 방식 3종 명칭 개편/설문지 지원 완료**:
  1. **단순 확인 완료형 (`acknowledgment`) 개선**:
     - 피할당 교사가 업무 확인 시 불필요한 복잡한 폼(타임테이블/PPT 첨부) 대신, 지침 확인 안내 카드와 **`의견 첨부 (선택)`** 텍스트에어리어를 제공.
     - 의견이 있을 경우 작성하여 제출하고, 없으면 단순 원클릭으로 확인 완료 처리.
     - 제출 다이얼로그 및 취합 다이얼로그(`task-submissions-dialog.tsx`)에서 `✓ 확인 완료` 뱃지 및 첨부된 의견 실시간 표시 연동.
  2. **업무 해결 방식 명칭 개편 및 설문지(Forms) 지원**:
     - `[시트 1] 사용자 지정 시트 링크형` -> **`사용자 문서 링크형`** (Google Sheets, Docs, Slides 또는 Google Forms 설문지 링크 등록 및 새 설문지/새 시트 바로가기 버튼 제공).
     - `[시트 2] 표준 템플릿 자동 로드형` -> **`표준 시트 양식 배포`** (중앙 드라이브 자동 생성 연동).
     - `[서식 3] 기안문 직행 HTML 표 취합형 (강력 추천)` -> **`기안문 붙임 문서 자동 생성형`**.
     - 피할당자/취합 화면 배너도 링크 성격(구글 폼인지 시트인지)에 따라 동적으로 알맞은 명칭과 바로가기 버튼(`Google 설문지 바로 열기` / `Google Sheets 바로 열기`) 제공.

---

## 2. Modified & Created Files (수정 및 생성된 파일)
1. `src/components/tasks/create-department-task-dialog.tsx` [MODIFY]
   - 업무 해결 방식 카드 3종 명칭 및 설명 수정.
   - `사용자 문서 링크형` 옵션 패널에 설문지(Forms)/시트/문서 지원 및 새 설문지(`forms.new`) 바로가기 추가.
2. `src/components/tasks/submit-department-task-dialog.tsx` [MODIFY]
   - 단순 확인 완료형 전용 뷰 및 `의견 첨부 (선택)` 입력창 구현.
   - 링크 유형(Forms vs Sheets)에 맞춘 배너 및 열기 버튼 분기.
   - `MessageSquare` import 누락 수정.
3. `src/components/tasks/task-submissions-dialog.tsx` [MODIFY]
   - 단순 확인형 교원별 상태 뱃지(`✓ 확인 완료` / `⏳ 미확인`) 및 첨부 의견 말풍선 연동.
   - 설문지/시트 배너 명칭 및 바로가기 버튼 연동.

---

## 3. Next Steps (다음 작업 목표)
- 사용자 추가 피드백 대응.
