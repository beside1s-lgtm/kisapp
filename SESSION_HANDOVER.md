# KISAPP Development Session Handover

## 1. Current Status (현재 상태)
1. **관리자 페이지 상단 고정 요소 덜컹거림(Jitter) 0.0px 완전 해결**:
   - 스크롤 전(scrollTop=0) 초기 상태에서 헤더와 탭 영역 사이에 존재하던 42px 공백(Gap)을 완전히 제거하여 처음부터 헤더 밑면에 0px 틈으로 밀착.
   - sticky top 오프셋을 헤더 높이(`--site-header-height`)에 정밀 일치시켜, 스크롤 시작 시나 도중에도 위아래로 단 1픽셀도 흔들리지 않고 그 자리에 딱 고정(Fixed)되도록 개선.
2. **탑승 학생 관리 탭에서도 버스/요일/경로 필터 상단 고정 적용**:
   - 기존 `버스 설정` 탭뿐만 아니라 요청하신 `탑승 학생 관리` 탭에서도 동일하게 버스/요일/경로 필터가 기능 선택 탭 바로 아래에 묶여 상단에 흔들림 없이 고정되도록 구현.
   - `탑승 학생 관리` 탭 본문 내의 중복 필터 블록은 깔끔하게 정리.
3. **미편성 목적지 추천 및 목적지 그룹 이동 블록 가독성 강화**:
   - 제목, 목적지 명, 학생 수, 버튼, 드롭다운 등의 텍스트 크기를 1.5배 확대하여 가독성 개선.
4. **목적지별 평일/토요일 그룹 선택 드롭다운 버튼 균일화**:
   - 평일 및 토요일 그룹 드롭다운의 가로 길이를 `w-32 sm:w-36`으로 통일하고 글씨 크기 1pt 확대(`text-xs`).
   - `평일`/`토` 뱃지의 가로 폭(`w-8 text-center`)도 일치시켜 단정하게 정렬.

---

## 2. Modified Files (수정된 주요 파일)
1. `src/components/layout/main-layout.tsx`:
   - `header` 요소의 높이를 측정하여 CSS 변수로 반영하고, 내부 `main`의 `overflow-x-hidden`을 제거하여 자식 sticky 요소가 스크롤 컨테이너에 정확히 부착되도록 개선.
2. `src/app/(app)/admin/bus/page.tsx`:
   - `TabsList`와 버스 설정용 `AdminPageFilter`를 묶어 sticky 래퍼에 배치(오직 `activeTab === 'bus-configuration'`일 때만 필터가 포함되어 상단 고정).
3. `src/app/(app)/admin/bus/components/bus-configuration-tab.tsx`:
   - 미편성 목적지 추천 및 목적지 그룹 이동 블록 글씨 크기 1.5배 확대.
   - 목적지 목록 내 평일/토요일 드롭다운 가로 폭 통일 및 글자 크기 1pt 확대.
4. `src/app/(app)/admin/bus/components/student-unassigned-panel.tsx`:
   - 미배정 학생 검색 후 Enter 입력 시 카드 자동 스크롤 기능 구현.

---

## 3. Next Steps (다음 작업 목표)
- 사용자의 명시적 배포 지시("배포해줘") 시 Firebase 호스팅 배포 진행.
