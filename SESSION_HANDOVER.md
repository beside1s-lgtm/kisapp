# 📋 SESSION HANDOVER (스쿨버스 및 학사일정 / 방과후학교 통합 시스템)

## 1. Current Status (현재 상태)
이번 세션에서는 **학사일정 공휴일 연동 및 아침 교문맞이 근무표 정상화**, **버스 선생님 페이지 전체 버스 담당 교사 현황 팝업 개편 및 실시간 동기화**, **React Hook 규칙(Rules of Hooks) 준수 및 런타임 에러 완전 해결**을 완료했습니다.

### 이번 세션 달성 주요 목표:
1. **학사일정 & 아침 교문맞이 근무표 공휴일 완전 동기화**:
   - 시스템 설정의 학사일정(`academicCalendar.events`)을 기준으로 비수업일/공휴일(추석, 한글날 등)을 실시간 매핑.
   - 9월 24일 하드코딩 오류 제거 및 추석(9월 25일) 명칭 자동 표기, 과거 더미 데이터 자동 클렌징 구현.
2. **버스 선생님 페이지 [전체 버스 담당 교사 현황] 실시간 리스너 및 탭 구조 / 학기 모드 격리**:
   - 관리자 페이지에서 통학버스 배정 시 등교(`Morning`)와 하교(`Afternoon`) 노선이 모두 동기화되도록 수정.
   - **학기 중(`regular`) vs 방학 중(`vacation`) 버스/노선 완전 격리**: `02`, `08`, `18` 등 방학용 버스가 학기 중에 섞여 나오던 문제를 `semesterMode` 필터링을 통해 완전 차단.
   - 통학버스는 등/하교 담당 교사가 100% 동일하므로 **[통학 (등·하교)]** 단일 탭으로 통일.
   - **[방과후]**(요일별) 및 **[토요 버스]**를 별도 탭으로 분리하여 명확한 구분 제공.
   - 비활성/배정제외 버스 필터링(`operationalBuses`) 및 중복 교사명 제거(`Set`).
   - **배정 해제 시 데이터 완전 무결성 보장**: 
     - 노선 배정 결과(`r.teacherIds`)만을 단일 진실 공급원으로 정립하여 과거 교사 문서의 레거시 버스 정보로 잘못 폴백하던 문제를 원천 차단.
     - 배정 초기화(`handleUnassignAllTeachers`) 또는 개별 배정 해제 시 교사 문서에 저장된 `assignedBusId`/`assignedAfterSchoolBusId`도 완전 삭제(`''`) 처리.
     - 기존 Firestore에 남아있던 고아/레거시 배정 필드를 자동으로 감지하여 초기화하는 자동 스크럽(`Auto-Scrub`) 연동.
     - 교사 삭제/일괄 삭제 시 해당 교사가 포함된 모든 노선의 `teacherIds`도 즉시 자동 정리.
     - **[되돌리기(Undo)]**는 사용자가 방금 실행한 직전 1회 작업에 한해서만 동작하도록 안전 상태 관리.

3. **버스 조장 해제 시 활동 내역 및 DB 기록 완전 삭제**:
   - 전체 버스 조장 현황에서 조장을 해제(`handleDemoteAll`, `handleBulkDemote`, `toggleLeaderInDialog`)하거나 개별 버스 관리에서 해제(`toggleGroupLeader`)할 때 종료일(`endDate`)만 남기고 유지되던 과거 기록을 **완전 삭제(`filter` 및 빈 배열 저장)** 처리.
   - 조장 관리(`GroupLeaderManager`) 컴포넌트에서도 해제된 학생의 잔여 활동 내역이 표출되지 않도록 활성 조장만 필터링 및 동기화.
   - 데이터베이스(`busLeaders/${busId}/records`)에 남아있던 기존 비활성/종료 기록 자동 정리 연동.

4. **아침 등교 지도교사 배정표 확인 팝업 (`MorningGateDutyDialog`) 추가**:
   - 상단 헤더 툴바([방과후 명단]과 [담당 버스 확인] 사이)에 **[등교지도 근무표]** 버튼 신설 (데스크톱 및 모바일 반응형).
   - 시스템 설정의 현재 학기(`morningGateDutyMulti`)를 실시간 연동 참조하며, 필요 시 다른 학기 배정표도 즉시 조회 가능.
   - **오늘(`오늘 근무자` - 앰버/오렌지 색상 강조 및 뱃지)** 및 **내일(`내일 근무자` - 스카이/블루 색상 강조 및 뱃지)** 상단 퀵 카드 및 전체 표 실시간 하이라이트.
   - 로그인한 선생님 본인의 당번일인 경우 **당번 알림 배너 및 표 내 `(본인)` 하이라이트** 제공.
   - 엑셀 다운로드 및 인쇄 기능 제공.

5. **방과후학교 관리자 운영 종료(`CLOSED`)와 스쿨버스 시스템 완전 실시간 연동**:
   - 방과후 관리자가 학기 운영 종료 시 스쿨버스 시스템의 강좌 정보(`clearAllAfterSchoolClasses`)가 자동 정리되도록 연동.
   - 방과후 진행 상태(`afterschoolStageStatus === 'CLOSED'` 또는 미운영) 시 스쿨버스 교사용 화면에서 이전 학기/방학 방과후 강좌가 검색되지 않도록 차단.
   - [방과후 명단 조회] 팝업 시 "방과후학교 운영이 종료되었습니다" 안내 뷰 및 뱃지 표출.
   - 메인 화면 노선 탭에서 방과후(`AfterSchool`) 탭 자동 숨김 및 정규 하교(`Afternoon`)로 안전하게 자동 전환.

6. **로그인 상태에 따른 상단 [홈]/[뒤로가기] 버튼 조건부 렌더링 및 버스 전용 로고 배지 적용**:
   - **로그인한 교직원/관리자(`user` 존재)**: 기존처럼 [뒤로가기] 및 [홈(결재함)] 버튼이 정상 노출되어 자유롭게 결재 시스템과 이동 가능.
   - **비로그인 사용자(버스 간편 PIN 접속 교사 / 학부모 등)**: [뒤로가기] 및 [홈] 버튼을 자동으로 숨기고, 깔끔한 **`[🚌 KIS BUS]` 전용 로고 배지**로 대체 표출하여 실수로 인한 결재 로그인 화면 이탈 방지.

7. **모바일 전용 PWA (Progressive Web App) 설치 기능 구현**:
   - `manifest.json`, 서비스 워커(`sw.js`), 고해상도 아이콘(192x192, 512x512, apple-touch-icon 등) 연동.
   - 모바일 접속 시 하단 **[📲 전용 앱 설치하기 (1초)]** 배너 자동 표출 (안드로이드 원클릭 네이티브 설치 및 iOS 홈 화면 추가 안내).
   - 앱 설치 후 주소창 없는 전체 화면 독립 실행형(`standalone`) 앱으로 동작.

8. **React Hook 규칙 준수 및 런타임 에러 해결**:
   - `TeacherPage` 컴포넌트 내 조건부 렌더링/조기 반환(`if (loading)`, `if (!isAuthenticated)`) 하단에 있던 `useMemo` 훅들(`loggedInTeacherDoc`, `teacherBusInfoText`)을 컴포넌트 최상단으로 재배치하여 `Rules of Hooks` 위반 런타임 에러 완전 해결.

9. **배포 정보 (Deployment Info)**:
   - 프로덕션 빌드 검증 및 GitHub (`main`) 푸시 배포 완료: 최신 커밋(`1d1b263`)이 원격 저장소(`origin/main`)에 성공적으로 푸시되어 Firebase App Hosting 배포 파이프라인이 정상 트리거되었습니다.

---

## 2. Modified Files (수정된 주요 파일)

| 파일 경로 | 수정 사유 및 주요 변경 내용 |
| :--- | :--- |
| [`src/components/settings-modal.tsx`](file:///c:/myapp/kisapp/src/components/settings-modal.tsx) | 학사일정 기본값 수정 (추석 9월 25일로 정정) |
| [`src/app/(app)/admin/bus/components/morning-gate-duty-tab.tsx`](file:///c:/myapp/kisapp/src/app/%28app%29/admin/bus/components/morning-gate-duty-tab.tsx) | `DEFAULT_HOLIDAYS` 내 9월 24일 제거, 시스템 학사일정 실시간 연동 및 과거 데이터 자동 클렌징 |
| [`src/app/(app)/admin/bus/components/teacher-management-tab.tsx`](file:///c:/myapp/kisapp/src/app/%28app%29/admin/bus/components/teacher-management-tab.tsx) | 통학버스 배정(개별/일괄/초기화/해제) 시 Morning과 Afternoon 노선 모두 일괄 동기화 및 마운트 시 자동 검증/복구 구현 |
| [`src/app/teacher/bus/page.tsx`](file:///c:/myapp/kisapp/src/app/teacher/bus/page.tsx) | `TeacherAssignmentViewDialog` 실시간 구독(`onSnapshot`) 전환, 통학/방과후/토요 탭 분리, Hook 최상단 재배치로 Hook 에러 완벽 해결 |

---

## 3. Next Steps (다음 작업 목표)

1. **버스 선생님 페이지 실제 단말기(모바일/태블릿) UI 반응형 점검**:
   - 상단 헤더 배정 안내 및 좌석표 출결 체크 화면의 가독성 최종 확인.
2. **관리자 버스 배정 변경 시 실시간 브로드캐스팅 동작 모니터링**:
   - 통학/방과후 배정 변경 시 버스 교사 화면에 실시간 즉각 반영 여부 유지 관리.

---

## 4. Important Context (핵심 컨텍스트)

- **통학버스 vs 방과후버스 배정 원칙**:
  - 통학버스는 주중(월~금) 등교(`Morning`)와 하교(`Afternoon`)가 **동일한 통학버스 담당 교사** 1명(또는 정원)으로 고정 배정됩니다.
  - 방과후버스는 요일별(월~금)로 다른 방과후 담당 교사가 배정됩니다.
- **Hook 규칙 필수 준수**:
  - `TeacherPage`의 모든 Hook(`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`)은 `if (loading)`이나 `if (!isAuthenticated)` 같은 early return 코드보다 **반드시 먼저** 최상단에서 호출되어야 합니다.
- **TypeScript 빌드 검증**: `npx tsc --noEmit` 통과 (0 errors).
