---
name: administrative-ops
description: 전자결재, 학교 조직도 및 수기 결재선, 대용량 학생 관리, 교직원 역할/직책별 권한 격리 및 대시보드 설정 작업 시 참조하는 표준 스킬
---

# KIS 행정 및 전자결재/권한 운영 표준 지침 (Administrative Operations)

## 1. 대용량 학생 마스터 및 온디맨드 쿼리
- 통합 학생 관리(`/admin/students`): 전교생 컬렉션 일괄 `onSnapshot` 구독 금지.
- 사용자가 조회할 학년(`selectedGrade`)을 선택했을 때만 `where('grade', 'in', gradeValues)` 조건부 쿼리 실행. 초기 상태는 직관적 빈 상태 안내 및 바로가기 제공.

## 2. 학교 조직도 및 전자결재 수기 결재선
- **학교 리더십 수기 결재자 성명 바인딩**:
  - 계정이 없는 교장/행정실장 등은 시스템 설정(조직도 > 학교 리더십)에서 성명 직접 입력(`principalName`, `administrativeHeadName`).
  - 공문서 작성기 및 복무 신청기는 가상 프로필을 지원하여 결재선 생성 시 `approver.name`으로 즉시 바인딩 (결재란 성명 출력 보장).
  - 3번째 결재 슬롯에 '행정실장' 직책 선택 지원.

## 3. 반복 루틴 업무 및 부장 그룹 할당
- **루틴 업무(`routine`)**: `routineConfig`로 반복 주기(`weekly`/`monthly`), 기준 요일/일자 관리. 전자결재 대시보드(`/inbox`)에서 미제출 시 루틴 알림 배너 표출.
- **부장 그룹(`head`)**: 부장 그룹 클릭 시 조직도 상의 행정 부서 부장, 학년 부장, 교무부장을 중복 없이 자동 추출하여 일괄 할당.

## 4. 대시보드 주요 업무 바로가기 교직원 역할별 격리
- 로그인한 교사의 실제 권한/직책에 해당하는 업무(`availableTasks`)만 선택 후보로 노출.
- 브라우저 공용 키 대신 이메일별 고유 키(`kis_dashboard_major_tasks_v2_${email}`)로 분리 저장. 기본값 부재 시 본인 담당 업무 상위 3개 자동 산출.

## 5. 직책별 권한 및 라우팅 엄격 격리
1. **실무 전담 계정(직책: '담당')**:
   - `UserProfile.loginRedirectUrl`로 로그인 직후 전용 페이지(`/admin/bus`)로 자동 리다이렉트.
   - `SidebarProvider`에서 `isSidebarOpen: false` 디폴트 고정 및 토글 차단, 상단 사이드바 버튼 숨김.
2. **외래/순회 강사(직책: '강사')**:
   - 오직 본인 방과후 출석부(`/teacher/afterschool`)와 버스 탑승(`/teacher/bus`)만 접근 허용.
   - 전자결재, 교원 서비스, 신규 기안 등은 사이드바/모바일 하단바/레이아웃에서 원천 차단. 비인가 접근 시 `/teacher/afterschool` 자동 리다이렉트.
   - 출석부 및 강좌 목록에서 전체 강좌 fallback을 금지하고, 본인이 주강사/추가강사/보조강사로 배정된 강좌(`myOwnCourses`)만 엄격 반환.
3. **관리자 권한 토글 및 슈퍼 관리자 한정**:
   - `isAdmin: true` 강제 주입은 최상위 슈퍼 관리자(`beside1s@kshcm.net`)로만 한정 (일반 전담 계정 하드코딩 금지).
   - 관리자 토글 변경 시 `updateProfile({ isAdmin: checked })`로 즉시 동기화, 설정 모달 열림 시 `fetchUsers(true)`로 캐시 무효화.
