---
name: kis-bus-ops
description: KIS 스쿨버스 및 방과후 시스템 개발, 노선/좌석 배정 로직, Dual Firebase 연동, 버스 필터링 및 학생 카드 연동 시 참조하는 표준 스킬
---

# KIS 스쿨버스 및 방과후 운영 표준 지침 (KIS Bus Operations)

## 1. Dual Firebase 아키텍처 불변 원칙
- **Primary Bus DB (`studio-8176556433-7698a`)**:
  - 메인 버스 DB: 계정, 버스(`buses`), 노선(`routes`), 학생(`students`), 좌석배치, 출결, 등교지도 보관.
  - `.env` 및 `apphosting.yaml`의 메인 프로젝트 ID를 포털 ID로 변경 금지.
- **Secondary Afterschool DB (`studio-9153973571-7837c`)**:
  - 방과후 강좌(`afterschool_courses`), 수강신청(`afterschool_enrollments`), 타이머 참조 전용.
  - 반드시 `src/lib/firebase-afterschool.ts`의 `afterschoolDb` 보조 인스턴스를 통해 접근.
- **Firestore Import 표준**:
  - 클라이언트 컴포넌트 내 동적 `require` 금지, 최상단 ES Module `import` 선언.

## 2. 노선/요일 필터링 및 데이터 정합성 규칙
1. **경로 및 요일 엄격 필터링**:
   - 목적지 파악, 미편성 목록, 탑승 학생 필터링 시 반드시 선택된 `routeType`(등교/하교/방과후)과 `dayOfWeek`에 실제 탑승하는 학생만 추출.
   - 방과후(`AfterSchool`): 해당 요일에 방과후 수업을 실제로 수강하거나 방과후 목적지가 등록된 학생만 대상. 수업 없는 요일(금요일 등)은 대상자 0명으로 처리. 일반 하교 목적지(`afternoonDestinationId`) 임의 fallback 사용 금지.
   - 노선(`stops`)에 이미 등록된 목적지(ID 및 명칭 매칭)는 미편성 목록에서 완벽 제외.
2. **관계형 참조 필드 유효 데이터 검증 (Orphan ID 방지)**:
   - 버스 번호, 목적지 등 참조 필드 렌더링 시 Firestore 문서 ID를 fallback으로 노출 금지. 등록된 유효 데이터(`b.name` 존재)만 필터링 후 번호순 정렬.
3. **버스 배정 제외(Excluded) 설정의 경로 타입별 격리**:
   - 등하교(`commute`), 평일 방과후(`afterSchool`), 토요일(`saturday`) 각 노선의 배정 제외 상태는 단일 boolean이 아닌 노선 타입별 독립 필드(`excludeFromAssignmentByType`)로 분리 저장 및 조회.
4. **방과후 수강 명단과 스쿨버스 명단 간 동명이인 오매칭 방지**:
   - 수강생(`enrollments`)과 학생(`students`) 간 대조 시 이름 단독 매칭 금지.
   - 반드시 고유 `studentId` 우선 매칭, 없을 경우 `이름 + 학년 + 반`(동일 학년/반 엄격 일치) 복합 키로만 매칭.
5. **실운행 버스 필터링**:
   - 배정 테이블 및 모달에서는 전체 버스가 아닌, 선택된 노선/요일에 실제 운행 계획(`stops`)이 있는 실운행 버스(`isBusOperational`)만 노출.

## 3. 학생 카드 및 방과후 수강 연동 규칙
1. **수강 취소(`CANCELLED`) 배제 및 학기/방학 격리**:
   - 취소된 신청(`status === 'CANCELLED'`)이나 미확정 상태는 배제하고 오직 확정(`ENROLLED`) 상태만 매핑.
   - 학기중(`regular`)과 방학(`vacation`) 모드는 강좌 속성에 따라 분리 처리.
2. **방과후 수업 제외(X) 시 양방향 완결 동기화**:
   - 학생 방과후 수업 제외(X) 실행 시 `afterSchoolClassIds`, `enrolledCourseTitles`, `afterSchoolCourseTitles`, 로컬 UI state를 즉시 갱신하고, 메인 방과후 수강 컬렉션(`afterschool_enrollments`)의 문서도 `status: 'CANCELLED'`로 동기화.
3. **학생 카드 조회 시 탑승 버스 좌석표 연동**:
   - 선택된 요일/경로에 배정된 학생 조회 시 탑승 버스명, 좌석 번호 뱃지 및 인라인 버스 좌석표(`BusSeatMap`)를 렌더링하고 해당 좌석 강조. 미배정 학생은 기본 카드만 간결 표시. 상단 목적지 오류 카드는 기본 접힘(`isUnassignableFolded = true`) 유지.
4. **방과후 강사진 상호 보완 (주강사/보조/추가강사 1~4)**:
   - 스쿨버스 DB(`after_school_classes`)와 메인 방과후 DB(`afterschool_courses`)를 상호 보완(`getComplementaryInstructors`)하여 주강사, 추가강사(1~4), 보조강사 전체를 식별 및 표출.
5. **요일별 강좌 일치**:
   - 탑승 학생 명단 및 카드에서 전체 요일 강좌명을 fallback으로 쓰지 않고, 현재 선택된 요일(`selectedDay`)에 진행되는 강좌만 대조하여 표출.
6. **하교 미배정 명단 내 '종료후복귀' 배지 표준화**:
   - 하교(`Afternoon`) 미배정 카드에서 해당 요일에 방과후 수업/목적지가 있는 학생에게 방과후 강좌명 배지 옆에 `'종료후복귀'`(`amber` 톤) 배지 필수 표출.

## 4. 방과후 버스 번호 요일별 독립 조회
- 방과후 출석부, 외부 강사 공유 출석부, 수강생 명단에서 학생 문서의 단일 필드(`afterSchoolBusNo`)에 의존하지 않음.
- `routes` 컬렉션의 `type === 'AfterSchool'` 노선에서 학생 좌석(`seating`)을 찾아 `busesByDay: Record<string, string>` 매핑 구성.
- 회차 요일에 맞는 버스를 1순위로 조회하고, 주 2회 이상 서로 다른 버스 탑승 시 요일별 뱃지 각각 표출.

## 5. 레이아웃 및 뷰포트 고정 (Sticky)
- 스쿨버스 관리자(`/admin/bus`): `MainLayout`에 `contentClassName="p-0"` 적용 (AppLayout 스크롤 컨테이너 사용).
- 탭 및 필터 래퍼: `sticky top-[var(--site-header-height,64px)] z-20`으로 헤더 아래 무이탈 고정.
- 로그인 교사 접속 시 담당 버스 1순위 자동 선택 (담당 버스 없는 교사만 '전체' 표시).
