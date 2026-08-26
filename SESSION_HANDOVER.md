# SESSION HANDOVER — KIS 통합 포털 (KISAPP)

## 1. Current Status (현재 상태)

### 최근 완료 작업

1. **[스쿨버스 선생님 페이지 상단 여백 및 헤더 잘림 버그 완전 해결] (완료)**
   - `MainLayout.tsx`: 독립 라우트(`/teacher/bus` 등)에서는 글로벌 AppHeader가 없으므로 헤더를 **`sticky top-0 z-40`**으로 최상단 밀착 고정하여 불필요한 상단 여백(56~64px) 및 본문 카드 제목 가림/잘림 버그 완전 해결
   - `(app)` 내부 라우트(`/admin` 등)는 기존대로 `sticky top-14 sm:top-16 z-40` 정상 작동

2. **[학생 이름 검색 결과 드롭다운 가림/잘림 버그 해결] (완료)**
   - `MainLayout.tsx`의 `headerContent` wrapper에서 부모의 `overflow-x-hidden`을 제거하고 `relative z-50` 부여
   - `teacher/bus/page.tsx`의 검색 결과 드롭다운을 `shadow-2xl bg-white border border-slate-300 rounded-xl` 팝업 레이어로 개선하여 검색 결과가 잘리지 않고 시원하게 표출

3. **[전체 버스 상태에서 학생 검색 선택 시 해당 학생의 버스로 즉시 이동 구현] (완료)**
   - `handleSelectStudentFromSearch`:
     - 1순위: 현재 요일/경로의 좌석표에서 학생의 `busId` 탐색
     - 2순위: 다른 요일/경로라도 학생이 배치된 노선의 `busId` 및 요일/경로로 자동 전환
     - 3순위: 학생 정보에 등록된 버스 번호(`morningBusNo`, `afternoonBusNo`, `afterSchoolBusNo` 등)를 `filteredBuses`와 매칭하여 해당 버스 ID로 즉시 `setSelectedBusId` 변경
     - 이동 시 토스트 알림 및 학생 카드 영역으로 자동 부드러운 스크롤 연동

4. **[방과후 수강확정생 강의료 1,600,000 VND 표준 연동 & 토요 버스비 규칙 분리 완료]**

## 2. Modified Files

| 파일 경로 | 변경 내역 |
|:---|:---|
| `src/components/layout/main-layout.tsx` | 라우트별 sticky top 분기(teacher는 top-0) 및 headerContent overflow 제거 |
| `src/app/teacher/bus/page.tsx` | handleSelectStudentFromSearch 학생 버스 즉시 이동 개선 & 검색 드롭다운 UI 스타일 강화 |
| `src/components/afterschool/teacher/StudentManagement.tsx` | getStudentTuitionFee 1,600,000 VND 산출 & 토요 버스비 연동 |
| `src/app/(app)/admin/bus/components/bus-configuration-tab.tsx` | 평일/토요일 요금제 탭 분리 |

## 3. Context

- Firebase 프로젝트 ID: studio-9153973571-7837c
- 개발 서버: http://localhost:9002 (task-2737 정상 구동 중 - 200 OK)
- 배포 원칙: 사용자 명시적 승인 시만 배포 실행
