# KISAPP Development Session Handover

## 1. Current Status (현재 상태)
1. **학사일정 공유 팝업 및 전용앱 다운 팝업 보안/프라이버시 노출 차단 (로그인 후 대시보드 진입 시에만 표시)**:
   - **학사일정 공유 팝업(`AcademicCalendarSyncModal`)**:
     * 최초 사이트 접속 화면, 로그인 화면(`/login`, `/parents/login`), 루트 리다이렉트(`/`), 약관 페이지(`/privacy`) 등에서는 학교 정보 외부 유출 방지를 위해 팝업 렌더링을 원천 차단.
     * 로그인이 완료되어 실제 교직원 대시보드(`/inbox`, `/admin/...`, `/teacher/...` 등) 또는 학부모 대시보드(`/parents` 서비스 경로)에 정상 진입했을 때만 팝업을 표시하도록 개선.
     * 전용앱(PWA Standalone)으로 접속한 경우에도 로그인 전에는 절대 뜨지 않고, 구글 로그인 성공 후 대시보드에 진입했을 때만 정상 노출.
     * '다시 띄우지 않기' 설정(계정 DB 및 로컬 스토리지 버전 체크) 완벽 유지.
   - **전용앱 다운 팝업(`PwaInstallPrompt`)**:
     * 비로그인 상태 및 로그인 전 화면에서는 다운로드 유도 배너를 일절 띄우지 않음.
     * 로그인이 성공하여 대시보드에 진입한 사용자 중 아직 앱을 설치하지 않은 웹 브라우저 사용자에게만 우측 하단 배너 노출.
     * 이미 전용앱(Standalone) 모드로 실행 중인 경우에는 중복 다운로드 배너 차단 유지.
     * '7일간 보지 않기' 및 '다시 보지 않기(영구)' 설정 완벽 유지.
2. **관리자 페이지 상단 고정 요소 덜컹거림(Jitter) 0.0px 완전 해결**:
   - 스크롤 전 초기 상태(scrollTop=0)에서 헤더와 탭 영역 사이의 42px 간격을 제거하여 0px 틈으로 완전 밀착.
   - 스크롤 시 위아래 흔들림 없이 그 자리에 칼같이 딱 고정.
3. **탑승 학생 관리 탭에서도 버스/요일/경로 필터 상단 고정 지원**:
   - 버스 설정 탭뿐만 아니라 탑승 학생 관리 탭에서도 버스/요일/경로 필터가 상단에 함께 고정되도록 통합.

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
