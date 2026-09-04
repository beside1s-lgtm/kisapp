# SESSION HANDOVER

## Current Status
- 스쿨버스 선생님 페이지(`/teacher/bus`)에 비로그인 게스트 접속 시 하단 네비게이션바 숨김 처리 및 보안 가드 구현 완료.
- 로그인한 교직원/관리자가 접근 시 하단 네비게이션바 정상 노출 유지.
- 비로그인 사용자가 주소창 조작 등으로 다른 시스템 내부 페이지(`/teacher/afterschool`, `/inbox` 등) 접근 시 로그인 화면 리다이렉트 및 Access Denied 차단 처리 완료.
- 학사일정 및 방과후 출석부/수업일수 계산 시 기간형 일정(시작일~종료일) 전체를 휴업일로 정확하게 반영하는 로직 개선 및 검증 완료.

## Modified Files
1. `src/components/layout/mobile-bottom-nav.tsx`: 비로그인 상태(`!user`)이거나 비로그인 스쿨버스 접속 시 컴포넌트 렌더링을 차단(`return null`).
2. `src/components/layout/main-layout.tsx`: `hideMobileBottomNav` 지원, 비로그인 상태에서 홈 버튼 및 내부 경로 이동 차단, 공개 페이지 외 접근 시 보안 가드 처리.
3. `src/app/teacher/bus/page.tsx`: 비로그인 여부에 따라 하단 네비게이션바 숨김(`hideMobileBottomNav={!user}`) 설정.
4. `src/lib/afterschool/schedule.ts`: 방과후 수업일수 및 출석부 생성 시 기간형 학사일정(start~end) 전체를 휴업일로 계산하도록 보강.
5. `src/lib/services/academicCalendarService.ts`: 다가오는 학사일정 계산 시 종료일 기준(`end.toDate() < todayStart`) 필터링 적용.

## Verification
- Puppeteer 브라우저 테스트:
  - 게스트 상태 `/teacher/bus` 접속 시 하단 네비게이션바 부재(`hasBottomNav: false`) 및 홈/이동 링크 숨김 확인 완료.
  - 게스트 상태 `/teacher/afterschool`, `/inbox` 강제 접근 시 `/login` 리다이렉트 및 접근 차단 확인 완료.
  - 교직원 세션 로그인 후 `/teacher/bus` 접속 시 하단 네비게이션바 정상 렌더링 확인 완료.
