# SESSION HANDOVER

## Current Status
모든 요청 작업 완료, 빌드 검증 완료 및 배포 진행 단계

## Recently Completed Work

### 1. 방과후 수업 드롭다운 중복 Key 콘솔 에러 해결
- **문제 원인**:
  - 방과후 강좌 목록에 복수 요일 연동 또는 동일 강좌 ID(`c.id`)가 중복 로드되어 Radix UI의 `SelectItem`에서 `key={c.id}` 및 `value={c.id}`가 중복되어 발생 (`Encountered two children with the same key, 'c_1787909263750_ihell'`).
- **수정 내역**:
  - `src/app/(app)/admin/bus/components/after-school-management-tab.tsx`: `displayClasses` useMemo에서 `seenIds`를 활용해 강좌 ID 기준 중복 제거.
  - `src/components/bus/after-school-inquiry-dialog.tsx`: `displayClasses` useMemo에서 강좌 ID 기준 중복 제거.

### 2. 방과후 학생 명단 버스 탑승자 필터링 기능 구현
- **요청 사항**: "방과후 학생 명단을 검색할 때, 버스 탑승자만 볼 수 있게 필터링 기능을 만들어줘."
- **수정 내역**:
  - `after-school-management-tab.tsx`:
    - 상단 `학생 이름으로 수업 검색` 영역에 `[v] 버스 탑승자만` 체크박스 필터 추가 (스쿨버스 번호 또는 방과후/방학 하교 목적지가 있는 학생의 수업만 필터링).
    - 강좌 선택 시 나타나는 수강 학생 명단 테이블 상단에 `[버스 탑승자만 보기]` 토글 버튼 및 탑승자 카운트 뱃지 추가.
    - 미배정('-') 학생을 제외하고 실제 버스 탑승자만 필터링되어 노출되도록 `displayedClassStudents` useMemo 구현.
    - `[명단 다운로드]` 실행 시 현재 필터링된 상태(버스 탑승자만)로 엑셀 파일 다운로드 연동.
  - `after-school-inquiry-dialog.tsx`:
    - 방과후 조회 다이얼로그 테이블 상단에도 `[버스 탑승자만]` 토글 버튼 및 CSV 다운로드 연동 적용.

### 3. 방과후 요일별 하교 목적지 상호 덮어쓰기 수정 및 where is not defined 해결
- `src/lib/kisbus/students.ts`: `where` 미임포트 ReferenceError 해결 및 `syncKisbusDestinationToMasterAddress`에서 대상 요일 외의 타 요일 목적지를 보존하도록 수정.

### 4. 다문화교육부 교직원 계정 오분류 및 중복 계정 정리
- `2021tram@kshcm.net`, `2021kimhoa@kshcm.net` 등 숫자 시작 이메일의 학부모/학생 오분류 방지(`isFaculty` 플래그 보장).

## Modified Files
| 파일 | 주요 변경 내역 |
|------|----------------|
| `src/app/(app)/admin/bus/components/after-school-management-tab.tsx` | 중복 key 제거, 버스 탑승자 전용 필터링 UI 및 엑셀 연동 |
| `src/components/bus/after-school-inquiry-dialog.tsx` | 중복 key 제거, 버스 탑승자 전용 필터링 및 CSV 연동 |
| `src/lib/kisbus/students.ts` | where 임포트 수정, 요일별 방과후 목적지 보존 |
| `src/lib/kisbus/assignments.ts` | 토요 방과후 노선 격리 및 좌석 배정 보호 |
| `src/components/settings-modal.tsx` | 교직원 등록 시 isFaculty 설정 및 배지 표시 |
| `src/lib/services/userService.ts` | 교직원 플래그 영구 동기화 |
| `src/lib/types.ts` | UserProfile에 isFaculty, isStaff 추가 |

## Build & Deployment Status
- `npm run build`: Compiled successfully (44개 라우트 검증 통과)
- Target Firebase Project: `studio-9153973571-7837c`
- Deployment Channel: GitHub main push -> Firebase App Hosting 자동 배포
