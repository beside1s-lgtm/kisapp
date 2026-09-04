# SESSION HANDOVER

## Current Status
모든 요청 작업 완료 및 프로덕션 배포 완료 (최신 커밋: `14b504f`)

## Recently Completed Work

### 1. 교직원 수동 등록 계정 표식(Badge) 및 학생/학부모 오분류 원천 차단
- **문제 원인**:
  - `2021tram@kshcm.net`, `2021kimhoa@kshcm.net` 등 연도 숫자(4자리)로 시작하는 이메일을 교직원 탭에서 수동 등록하더라도, `auth-provider.tsx`의 이메일 정규식 패턴 검사(`/^\d{2,8}.../`)에 걸려 `role: '학부모'`로 강제 덮어쓰기되거나 학생 계정으로 오인되는 결함이 존재했습니다.
- **개선 및 수정 내역**:
  - `UserProfile` 타입(`src/lib/types.ts`)에 `isFaculty?: boolean`, `isStaff?: boolean` 명시적 플래그 필드 추가.
  - `settings-modal.tsx`: 교직원 탭에서 수동 등록(`handleAddNewUser`) 시 `isFaculty: true`, `isStaff: true`를 포함하여 저장.
  - `settings-modal.tsx`: 교직원 목록 테이블의 사용자명 옆에 **[교직원]** 배지 표식을 명시적으로 부착하여 학생 계정과 시각적으로 명확히 구분.
  - `settings-modal.tsx`: 교직원 탭 카운트 및 테이블 필터, 학생 계정 필터를 동일한 `isTeacherUser` 판별 함수로 통합하여 일치시킴 (`isFaculty === true`, 부서원, `dept` 보유자, `role === '교사'`는 무조건 교직원 탭에만 배정).
  - `auth-provider.tsx`: `isTeacher` 및 `isParent` 판별 시 `profile.isFaculty`, `dept`, 교직원 role을 우선 검사하여, 이메일이 숫자 패턴이더라도 절대 학생/학부모로 오분류되지 않도록 방어.
  - `userService.ts`: `getUsersDirectory`, `onUsersDirectoryUpdate`, `bulkRegisterUsers`에서 `isFaculty`, `isStaff` 필드를 영구 동기화.

### 2. 토요 방과후 신청 학생 토요일 등하교 버스 노선 미배정 목록 노출 및 격리
- **규칙 배경**:
  - 평일과 달리 토요일은 별도의 방과후 노선(`AfterSchool`)이 존재하지 않으며, 토요 방과후 신청 학생은 한글학교 학생들과 함께 **토요일 등하교(Saturday Morning / Afternoon) 버스**를 이용합니다.
  - 기존에는 [방과후 노선으로 이동] 실행 시 평일 로직이 적용되어 토요 방과후 학생의 데이터가 꼬이거나 토요일 등하교 노선 관리 화면에서 미배정 목록에 나타나지 않고 사라지는 현상이 발생했습니다.
- **수정 내역**:
  - `src/app/(app)/admin/bus/components/student-management-tab.tsx`:
    - `selectedDay === 'Saturday'`일 때, `satMorningDestinationId`/`satAfternoonDestinationId`가 없는 토요 방과후 학생(`afterSchoolClassIds['Saturday']` 또는 `afterSchoolDestinations['Saturday']` 보유 학생)도 목적지를 자동 연동하여 토요일 등하교 노선의 **미배정 학생 목록에 정상 노출**되도록 수정.
    - `isTransferred`(방과후 노선 이동 완료 상태) 필터에서 토요일(`selectedDay === 'Saturday'`)은 제외하여 토요일 등하교 미배정 명단에서 학생이 사라지지 않도록 보호.
    - 토요 방과후 학생의 경우 정류장 일치 여부와 무관하게 토요일 미배정 목록에 노출되어 관리자가 원하는 토요 버스에 수동 좌석 배정을 진행할 수 있도록 개선.
  - `src/lib/kisbus/assignments.ts`:
    - `syncAfterSchoolWithKisbus`: 토요 방과후 신청 학생에게 `satMorningDestinationId`, `satAfternoonDestinationId`를 자동 보장.
    - `executeTransferAfterschoolStudentsToBus` 및 `transferAllAfterschoolStudentsToBus`: 평일 정규 하교 좌석 제외 대상 요일 목록에서 '토요일'(`Saturday`)을 원천 제외하고, `_hiddenAfternoonDestId`(평일 하교 숨김) 처리를 토요 강좌에는 적용하지 않도록 분리.

### 3. 방과후 출석부 및 버스 동명이인 오매칭 방지 (이전 커밋)
- `AttendanceManagement.tsx`: `getStudentInfo`에서 이름만으로 fallback 매칭하던 로직을 제거하고, 학년+반+이름이 일치할 때만 매칭하도록 엄격화.
- `StudentManagement.tsx`: `resolveStudentBusInfo` 3단계 fallback에서 동일 이름을 가진 학생이 2명 이상인 경우 오배정을 방지하기 위해 fallback 매칭 차단.

## Modified Files
| 파일 | 주요 변경 내역 |
|------|----------------|
| `src/lib/types.ts` | `UserProfile`에 `isFaculty?: boolean`, `isStaff?: boolean` 필드 추가 |
| `src/lib/services/userService.ts` | 교직원 등록 및 디렉토리 조회 시 `isFaculty` 영구 매핑 |
| `src/components/settings-modal.tsx` | 교직원 등록 시 `isFaculty: true` 저장, [교직원] 배지 표시, 필터 일원화 |
| `src/components/auth-provider.tsx` | 교직원 계정 학생/학부모 오분류 차단 및 프로필 보호 |
| `src/app/(app)/admin/bus/components/student-management-tab.tsx` | 토요 방과후 학생 토요일 등하교 노선 미배정 노출 처리 |
| `src/lib/kisbus/assignments.ts` | 토요 방과후 학생 토요일 등하교 버스 분리 및 좌석 제외 방지 |

## Build & Deployment Status
- `npm run build`: Compiled successfully (44개 라우트 정적/동적 빌드 완료)
- GitHub main 브랜치 푸시 완료 (`14b504f`) → Firebase App Hosting 자동 배포 진행
