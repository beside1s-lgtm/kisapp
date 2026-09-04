# SESSION HANDOVER

## Current Status
- 외부 강사용 독립 출석부 공유 링크 기능 및 전용 페이지(`/attendance/share/[courseId]`) 구현 완료.
- 방과후 출석부 상단에 [출석부 공유] 링크 복사 버튼 추가 완료 (클릭 시 전용 URL 복사 및 토스트 안내).
- 외부 강사(비로그인 게스트)가 해당 링크로 접속 시:
  - 오직 해당 강좌의 학생 명단, 회차/날짜 선택기, 간편 탭 출석(○/△/×/·) 기능만 제공.
  - 상단 헤더에 "KIS 출석부" 브랜딩 표시 및 홈/뒤로가기 버튼 제거로 시스템 이탈 원천 차단.
  - 모바일 하단 네비게이션바(`MobileBottomNav`) 완전 숨김 처리.
  - 출석 체크(결석/개별하교/출석) 시 Firestore 배치 저장 및 스쿨버스 시스템(`routes/{routeId}/attendance/{date}.notBoarding`) 실시간 연동.
- 비로그인 상태에서 다른 페이지(`/teacher/afterschool`, `/inbox` 등) 주소창 접근 시 즉시 로그인 페이지로 차단 및 리다이렉트.
- Next.js 프로덕션 빌드 통과 및 GitHub 원격 저장소(`origin/main`) 푸시를 통한 Firebase App Hosting 배포 트리거 완료.

## Modified Files
1. `src/app/attendance/share/[courseId]/page.tsx` [신규]: 외부 강사용 독립 출석부 페이지. 비로그인 접근 허용, 출석 체크 및 버스 시스템 실시간 연동.
2. `src/components/afterschool/teacher/AttendanceManagement.tsx`: 회차 선택기 상단에 [출석부 공유] 버튼 추가 및 링크 복사 핸들러 구현.
3. `src/components/layout/main-layout.tsx`: `/attendance/share/`를 공개 페이지로 등록, 게스트 브랜딩 분기(스쿨버스: KIS BUS, 출석부: KIS 출석부), 홈/뒤로가기 차단.
4. `src/components/layout/mobile-bottom-nav.tsx`: `/attendance/share/` 비로그인 접근 시 하단 네비게이션바 숨김 처리.
5. `src/lib/afterschool/schedule.ts`: 방과후 수업일수 및 출석부 생성 시 기간형 학사일정 전체 휴업일 반영.
6. `src/lib/services/academicCalendarService.ts`: 다가오는 학사일정 계산 시 종료일 기준 필터링 적용.

## Verification
- Next.js 프로덕션 빌드 검증:
  - `npm run build` 정상 완료 (`Compiled successfully in 51s`, 44개 정적/동적 라우트 생성 완료).
- Puppeteer 브라우저 실시간 검증:
  - 비로그인 상태에서 실제 강좌 공유 링크(`http://localhost:9002/attendance/share/c_1787191609050_9bidq`) 접속 검증:
    - `headerBranding`: "KIS 출석부" 정상 표시
    - `hasBottomNav`: false (하단바 완전 숨김)
    - `courseTitle`: "사고력 쑥쑥! 놀면서 배우는 창의수학 출석부" 표시
    - `studentRowCount`: 12명 학생 정상 렌더링
    - `homeBtnFound`: false (홈/뒤로가기 미노출로 내부 페이지 이동 차단)
  - 비로그인 상태에서 교사용 페이지(`/teacher/afterschool`) 접근 시 `/login?redirect=%2Fteacher%2Fafterschool` 즉시 차단/리다이렉트 확인.
  - 비로그인 상태에서 `/teacher/bus` 접근 시 `branding: "KIS BUS"`, `hasBottomNav: false` 확인.
  - 교사용 출석부 페이지(`/teacher/afterschool`)에서 `출석부 공유` 버튼 렌더링 및 클릭 복사 동작 확인.

## Deployment
- Git 커밋: `feat: implement external instructor attendance sharing page and link copy feature`
- 원격 푸시: `git push origin main` 완료 -> Firebase App Hosting 자동 배포 진행.
