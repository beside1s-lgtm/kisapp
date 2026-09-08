# Workspace Rules (KISAPP)

## 1. 신규 페이지 UI 디자인 및 반응형 레이아웃 필수 표준
새 페이지 또는 컴포넌트 추가 시 아래 규격을 엄격히 준수하여 레이아웃 붕괴와 스크롤 오류를 원천 방지한다.
- **최상위 레이아웃 표준**:
  - 모든 교원 및 관리자 페이지는 반드시 `MainLayout`으로 감싸 렌더링한다. (모바일 상단 헤더 뒤로가기/홈 및 최하단 5대 고정 네비게이션 `MobileBottomNav` 유실 방지)
- **데스크톱 뷰포트 & 고정 푸터**:
  - `AppLayout`에서 데스크톱(`lg:`)은 최하단 푸터(`AppFooter`)가 바닥에 고정(`shrink-0`)된다.
  - 페이지 본문 컨테이너는 반드시 `flex-1 min-h-0 overflow-y-auto` 또는 Zero-Scroll 구조를 유지하여 푸터 위 남은 공간을 100% 수납한다. 고정 높이(`min-h-[220px]`) 강제를 금지한다.
- **모바일 뷰포트 & 자연스러운 세로 스크롤**:
  - 모바일에서는 본문 내용이 길어질 때 아래로 자연스럽게 스크롤되도록 `overflow-y-auto overflow-x-hidden`을 유지한다 (`overflow-hidden`으로 닫기 금지).
  - 하단 네비게이션에 본문 하단이 가려지지 않도록 `pb-20 lg:pb-0` 패딩을 필수로 확보한다.
- **스크롤 컨테이너 및 팝업 떨림 방지**:
  - 모달, 시트, 팝업 등 내부 스크롤 목록 컨테이너에는 반드시 `overscroll-contain`을 적용하여 끝단 스크롤 시 부모 창 연쇄 스크롤(Jittering)을 차단한다.
- **텍스트/버튼 라벨 줄바꿈 방지**:
  - 좁은 폭에서 콜론(`:`), 직함, 버튼명 등이 다음 줄로 떨어지지 않도록 `whitespace-nowrap` 및 `inline-flex items-center`를 적용한다.
- **모바일 하단 드롭다운 방향 제어**:
  - 모바일 긴 목록의 하단 2개 이상 항목에서는 드롭다운 팝업이 화면 바닥 밖으로 잘리지 않도록 `bottom-full mb-1` (DropUp) 방향으로 렌더링한다.
- **UI 검증 필수**:
  - 레이아웃 작업 후 `ui-responsive-design` 스킬 지침에 따라 브라우저 도구로 뷰포트 렌더링을 실측 검증한다.

## 2. 공문서 및 학부모 신청서 A4 출력/인쇄 규격 필수 표준
결석계, 체험학습 신청서, 결과보고서 등 학교 공문서 및 신청서 출력 서식은 아래 규격을 엄격히 준수한다.
- **A4 1페이지 규격 엄격 제한 (297mm)**:
  - 1페이지 독립 서식(서식 1 신청서, 서식 2 결과보고서, 서식 3 결석계)은 인쇄 시 하단 서약란/직인이 2페이지로 밀리지 않도록 전체 높이를 A4 세로 규격(297mm) 내에 맞추고 테이블 행 높이와 여백을 정밀 계산한다.
- **인라인 테두리 보존**:
  - 브라우저 인쇄(`@media print`) 및 이미지 변환 시 테두리 유실을 방지하기 위해 모든 `table`, `th`, `td`에 인라인 스타일 `style={{ border: '1px solid #000000', borderCollapse: 'collapse' }}`을 명시한다.
- **PDF 변환 엔진 (html-to-image 1:1 캡처)**:
  - 가상 뷰포트 왜곡과 폰트 깨짐을 유발하는 `html2canvas` 사용을 일절 금지한다.
  - 반드시 `html-to-image`(`toPng`, `pixelRatio: 2.5`, `cacheBust: true`, `width: el.offsetWidth, height: el.offsetHeight`)를 사용하여 화면과 1:1 오차 없이 변환한다.
- **상단 결재란 직책 슬롯 2글자 고정**:
  - 결재란 헤더는 세부 보직명 대신 표준 슬롯명 `['담임', '부장', '교감', '교장']` 2글자 고정으로 렌더링하여 폭 붕괴 및 텍스트 쏠림을 방지한다.
- **서명란 줄바꿈 방지**:
  - '보호자 :', '학부모 :', '학생 :' 라벨과 기안자명, 직인 영역은 반드시 `inline-flex items-center whitespace-nowrap`으로 묶어 콜론(`:`) 단독 줄바꿈을 원천 차단한다.
- **테이블 셀 수직 중앙 정렬 & 여백**:
  - 단일행 셀은 `display: flex; align-items: center; padding: 2mm` 및 `leading-tight`를 적용하여 텍스트가 바닥에 붙지 않도록 수직 중앙 정렬을 유지한다.
- **원본대조필 직인 노출 격리**:
  - 교원/관리자 결재문서함(`/documents/[id]`)은 학교 보관용 원본이므로 직인을 표시하지 않는다.
  - 학부모 포털(`/parents/documents/[id]`)에서 결재 완료(`approved`)된 문서 출력본/PDF에만 하단 우측 여백에 날인한다.
- **서식 검증 필수**:
  - 문서 서식 작업 후 `parent-document-qa` 스킬을 호출하여 1페이지 수납 및 인쇄 상태를 검증한다.

## 3. Firebase 배포 안전 및 빌드 무결성 규칙
- **프로젝트 ID 바인딩 확인**:
  - 작업 시작 전 `.firebaserc` (`studio-9153973571-7837c`)와 `firebase.json` 확인.
  - CLI 배포 명령어 실행 시 타 프로젝트 오배포 방지를 위해 반드시 `--project <프로젝트ID>` 플래그를 명시한다.
- **사용자 명시 승인 필수**:
  - 사용자의 명시적인 배포 승인("배포해", "배포해줘")이 있을 때만 원격 푸시 및 배포 명령을 실행한다.
- **App Hosting 빌드 및 배포 파이프라인**:
  - `firebase.json`에 `alwaysDeployFromSource: true`가 설정된 프로젝트이므로, 배포 전 `npm run typecheck` (`tsc --noEmit`)로 타입 오류를 전수 점검한 뒤 `git push`로 원격 배포를 트리거한다.
  - Windows dev 서버 가동 중 파일 락(EPERM) 방지를 위해 로컬 `npm run build` 시도는 생략하고 `kis-pre-deploy-checklist` 스킬을 따른다.

## 4. 도메인별 심층 로직 스킬 참조 체계
세부 비즈니스 로직 수정 시에는 워크스페이스 전용 스킬을 호출하여 지침을 준수한다.
- **스쿨버스 및 방과후 배정/운영**: `.agent/skills/kis-bus-ops/SKILL.md`
  - Dual Firebase (Primary `studio-8176556433-7698a`, Secondary `studio-9153973571-7837c`) 아키텍처
  - 경로(`routeType`)/요일(`dayOfWeek`) 엄격 필터링 및 동명이인 복합키 매칭
  - 방과후 `CANCELLED` 배제, 제외(X) 양방향 동기화, 강사진 상호보완, 요일별 버스 매핑
  - 스쿨버스 관리자 헤더/탭바 이중 고정 (`sticky top-[var(--site-header-height,64px)] z-20`)
- **행정, 전자결재 및 교직원 권한 관리**: `.agent/skills/administrative-ops/SKILL.md`
  - 대용량 학생 마스터 온디맨드 그룹 쿼리 (`/admin/students`)
  - 학교 조직도 수기 결재자 성명 바인딩 및 부장 그룹 일괄 할당
  - 직책 '담당' 사이드바 비활성화 및 전용 리다이렉트 (`/admin/bus`)
  - 직책 '강사' 권한 격리 (본인 출석부 `/teacher/afterschool`, 버스 `/teacher/bus` 외 접근 차단)
  - 슈퍼 관리자 권한 강제 주입 한정 및 관리자 토글 실시간 세션 동기화
- **인쇄물 및 공문서 규격 검증**: `.agent/skills/parent-document-qa/SKILL.md`
- **반응형 UI 및 다국어 검증**: `.agent/skills/ui-responsive-design/SKILL.md`, `.agent/skills/mobile-multilingual-qa/SKILL.md`
