# KIS 통합 관리 시스템 아키텍처 및 소스코드 파일맵 (FILEMAP.md)

> 본 문서는 프로젝트 내 모든 도메인, 라우트, 컴포넌트, 서비스 로직의 위치를 신속하게 파악하고 핀포인트로 수정하기 위한 파일 구조 지도입니다.  
> **파일이 신규 생성, 삭제, 이동, 분리될 때마다 즉시 본 문서를 동기화하여 최신 상태를 유지합니다.**

---

## 1. 디렉토리 구조 요약

```
src/
├── app/                  # Next.js App Router 기반 화면 및 API 라우트
│   ├── (app)/            # 교직원/관리자 내부 포털 (MainLayout 적용)
│   ├── (auth)/           # 인증 (로그인 등)
│   ├── parents/          # 학부모 전용 포털 (ParentLayout 적용)
│   ├── teacher/          # 단독 뷰 (스쿨버스 교사용 화면 등)
│   └── api/              # 서버 API 엔드포인트 (Drive 연동 등)
├── components/           # UI 컴포넌트 (도메인별 격리)
│   ├── afterschool/      # 방과후 학교 컴포넌트 (학생/강사/스쿨버스)
│   ├── bus/              # 스쿨버스 교사용 화면 분리 컴포넌트
│   ├── dashboard/        # 대시보드 위젯
│   ├── document-form/    # 전자결재 기안 양식 및 결재선 다이얼로그
│   ├── health/           # 보건실 건강기록 관리 및 세부 탭
│   ├── inbox/            # 문서 수신함 및 통계 차트
│   ├── layout/           # 전역 레이아웃 (헤더, 사이드바 등)
│   ├── parents-apply/    # 학부모 신청서 모바일/데스크탑 분리 컴포넌트
│   ├── pe/               # 체육/PAPS 및 팀 밸런서 분리 컴포넌트
│   ├── settings/         # 환경설정 및 조직도 설정 탭
│   ├── tasks/            # 부서 업무/주간 계획 모달 및 폼 섹션
│   ├── teacher/          # 교원 전용 컴포넌트 (담임 학급관리 등)
│   ├── teacher-duty/     # 교원 복무/출장/연수 분리 컴포넌트
│   ├── ui/               # 공통 UI 원자 컴포넌트 (Shadcn/Radix)
│   └── volunteer/        # 봉사활동 관리 분리 컴포넌트
├── lib/                  # 비즈니스 로직, 서비스 계층, 유틸리티
│   ├── afterschool/      # 방과후 비즈니스 로직 및 모의 데이터
│   ├── kisbus/           # 스쿨버스 DB(kisbusDb) 연동 및 배정 알고리즘
│   ├── pe/               # PAPS 평가 엔진 및 체육 보고서 생성기
│   ├── server/           # 서버 사이드 전용 로직 (Google Auth 등)
│   ├── services/         # 도메인별 Firestore 서비스 레이어
│   └── types/            # 공통 데이터 모델 및 타입 정의
├── contexts/             # 전역 React Context (다국어 등)
├── hooks/                # 커스텀 React Hooks (인증, 토스트, 모바일 등)
└── locales/              # 다국어 리소스 (ko, en, vi)
firestore.rules           # Cloud Firestore 보안 규칙
storage.rules             # Firebase Storage 보안 규칙 (결석계 증빙 최대 50MB)
firebase.json             # Firebase 호스팅, 스토리지 및 App Hosting 배포 설정
```

---

## 2. 라우트 및 페이지 매핑 (`src/app/`)

### 가. 교직원/관리자 포털 (`src/app/(app)/`)
* **메인 대시보드 / 수신함**
  * `src/app/(app)/inbox/page.tsx` : 메인 결재 수신함 및 통계 대시보드
* **전자결재 문서 관리**
  * `src/app/(app)/new/page.tsx` : 신규 문서 기안 작성
  * `src/app/(app)/documents/[id]/page.tsx` : 문서 상세 조회 및 결재/반려
  * `src/app/(app)/edit/[id]/page.tsx` : 기안 문서 수정
  * `src/app/(app)/pending/page.tsx` : 결재 대기 문서함
  * `src/app/(app)/sent/page.tsx` : 결재 상신 문서함
  * `src/app/(app)/recalled/page.tsx` : 회수 문서함
  * `src/app/(app)/rejected/page.tsx` : 반려 문서함
  * `src/app/(app)/registry/page.tsx` : 결재 완료 문서 등록대장
  * `src/app/(app)/circular/page.tsx` : 공람 문서함
* **관리자 기능**
  * `src/app/(app)/admin/students/page.tsx` : 마스터 학생 계정 관리 및 엑셀 일괄 등록
  * `src/app/(app)/admin/bus/page.tsx` : 스쿨버스 노선, 배정, 운행 관리 대시보드
  * `src/app/(app)/admin/bus/components/` : 스쿨버스 관리자 세부 모달 및 컴포넌트
  * `src/app/(app)/admin/afterschool/page.tsx` : 방과후 강좌 관리 및 수강 현황
* **교무 및 학급 관리**
  * `src/app/(app)/teacher/homeroom/page.tsx` : 담임 출석부 및 학급 관리 메인
  * `src/app/(app)/teacher/duty/page.tsx` : 교원 복무(휴가, 출장, 41조 연수) 신청
  * `src/app/(app)/teacher/disease/page.tsx` : 교직원 건강/질병 신고 및 본인 내역 조회
  * `src/app/(app)/teacher/overtime/page.tsx` : 초과근무 신청
  * `src/app/(app)/teacher/substitution/page.tsx` : 보강/대결 신청
  * `src/app/(app)/teacher/registry/page.tsx` : 교원 복무 내역 대장
* **특수 업무 및 교과**
  * `src/app/(app)/teacher/pe/page.tsx` : 체육 관리, PAPS, 팀 편성기
  * `src/app/(app)/teacher/health/page.tsx` : 보건 관리 및 학생 건강기록부
  * `src/app/(app)/teacher/afterschool/page.tsx` : 방과후 강사 출석부 및 수강생 관리
  * `src/app/(app)/volunteer/page.tsx` : 학생 봉사활동 계획서 및 보고서 승인 관리
* **대장 조회**
  * `src/app/(app)/attendance-registry/page.tsx` : 전교 출결 마스터 대장
  * `src/app/(app)/field-trip-registry/page.tsx` : 현장체험학습 승인 대장
  * `src/app/(app)/parents-absence/page.tsx` : 학부모 결석계 접수 목록
  * `src/app/(app)/parents-fieldtrip/page.tsx` : 학부모 체험학습 신청 접수 목록

### 나. 학부모 포털 (`src/app/parents/` & `src/app/(parents)/`)
* `src/app/parents/page.tsx` : 학부모 홈 대시보드
* `src/app/parents/login/page.tsx` : 학부모 로그인
* `src/app/parents/setup/page.tsx` : 학부모 최초 자녀 PIN 연동 및 설정
* `src/app/parents/apply/page.tsx` : 결석계 및 체험학습 신청서 작성 (1,753줄 → 846줄, `parents-apply/` 컴포넌트 호출)
* `src/app/parents/history/page.tsx` : 신청 내역 및 결과보고서 제출
* `src/app/parents/bus/page.tsx` : 스쿨버스 탑승 조회 및 '오늘 안 탐' 신청
* `src/app/parents/bus/apply/page.tsx` : 신규 스쿨버스 이용 신청서
* `src/app/parents/volunteer/page.tsx` : 봉사활동 사전 계획서 및 확인서 신청
* `src/app/parents/afterschool/page.tsx` : 방과후 수강신청 및 현황
* `src/app/parents/consultation/page.tsx` : 학부모 상담 신청
* `src/app/parents/documents/page.tsx` : 가정통신문 및 공지 목록

### 다. 단독 교사 화면 & API
* `src/app/teacher/bus/page.tsx` : 스쿨버스 탑승 지도 교사용 화면 (전체 탑승, QR 체크)
* `src/app/api/drive/` : Google Drive 연동 API (폴더 동기화, 결석계 완결 PDF 자동 아카이빙, 시트 생성 등)
  * `src/app/api/drive/archive-absence/route.ts` : 결석계 최종 승인 시 Google Drive 03_결석계(완료) 폴더에 소견서 포함 완결 PDF 자동 아카이빙

---

## 3. 분리 및 모듈화된 핵심 컴포넌트 (`src/components/`)

### 가. 스쿨버스 교사용 화면 (`src/components/bus/`)
* `all-group-leaders-status.tsx` : 노선별 조장 탑승 현황 및 통계
* `all-students-boarding-status.tsx` : 전체 학생 탑승 상태 목록 및 필터링
* `teacher-assignment-view-dialog.tsx` : 버스별 탑승 학생 명단 및 좌석 확인 다이얼로그
* `teacher-settings-dialog.tsx` : 교사 담당 버스 설정
* `teacher-login-screen.tsx` : 교사 전용 로그인 인터페이스
* `web-copy-seat-plan-dialog.tsx` : 좌석 배치도 웹 클립보드 복사 모달
* `qr-camera-feed.tsx` : 학생 QR 스캔을 위한 실시간 카메라 피드
* `bus-page-utils.ts` : 스쿨버스 화면 전용 공통 유틸
* `BusSafetyConsentModal.tsx` : 스쿨버스 안전수칙 및 생활지도규정(제31조 2) 준수 동의서 모달

### 나. 봉사활동 관리 (`src/components/volunteer/`)
* `ApplyTabContent.tsx` : 봉사활동 개별 신청 탭
* `BatchTabContent.tsx` : 동아리/단체 봉사활동 일괄 신청 탭
* `RegistryTabContent.tsx` : 전교 봉사활동 승인 대장 탭
* `ReportTabContent.tsx` : 사후 확인서 및 결과보고서 검토 탭
* `HistoryTabContent.tsx` : 학생/학급별 봉사활동 이력 탭
* `BatchSubmitDialog.tsx` : 다수 학생 일괄 등록 모달
* `StudentSearchDialog.tsx` : 봉사 대상 학생 검색 다이얼로그
* `RejectDialog.tsx` : 봉사활동 반려 사유 작성 모달
* `PrintPreviewDialog.tsx` : A4 규격 출력 미리보기 모달

### 다. 담임 학급 관리 (`src/components/teacher/homeroom/`)
* `HomeroomAttendanceTab.tsx` : 담임 일일 출석부 탭
* `ClassManagementTab.tsx` : 학급 관리 종합 탭 (아래 하위 컴포넌트 호출)
* **`class-management/` 서브 모듈**:
  * `HomeworkTabContent.tsx` : 과제 출제 및 제출 관리
  * `BehaviorTabContent.tsx` : 학생 행동특성 및 종합의견 기록
  * `MemoTabContent.tsx` : 일일 메모 및 특이사항 관리
  * `MatrixTabContent.tsx` : 학생 평가 매트릭스 뷰
  * `ReviewTabContent.tsx` : 학기말 종합 평가 검토 탭
  * `BehaviorInputDialog.tsx` : 행동 기록 빠른 입력 팝업
  * `EditHomeworkDialog.tsx` : 과제 수정 모달
  * `MemoHistoryDialog.tsx` : 과거 메모 이력 조회 모달
* `GradeMaterialsTab.tsx` : 학년 자료실 탭
* `ParentConsultationTab.tsx` : 학부모 상담 관리 탭
* `HomeroomProxyApplyForm.tsx` : 담임 대리 결석/체험학습 신청 폼

### 라. 보건 및 감염병 관리 (`src/components/health/`)
* `HealthRecordManagement.tsx` : 건강기록부 관리 메인 컨테이너 (인적사항, 검진, PAPS 연동)
* `DiseaseSurveillanceManagement.tsx` : 감염병 및 질병 현황 모니터링 관리 컨테이너 (초·중등·교직원 분리, 결석/발생 핀포인트 대장, 월간/연간 인쇄 및 엑셀)
* **`disease-surveillance/` 서브 모듈**:
  * `types.ts` : 감염병 및 질병현황 공통 타입, 통계 인터페이스, 공통 질병 메타데이터
  * `AbsenceDiseaseSelector.tsx` : 결석계 전용 질병 형태(단순/감염/식중독) 3대 탭, 병명 검색/칩 선택, 직접 입력 및 상세 증상 입력 컴포넌트
  * `DiseaseStatsCards.tsx` : 핵심 4대 대시보드 통계 카드 (결석/질병 수, 발생 학급/부서 수, 격리 수, 다발 병명)
  * `DiseaseToolbar.tsx` : 대상/연월/연간 전체 선택 툴바, 인쇄/엑셀/등록 액션 바, 검색 및 병명 필터
  * `DiseaseTable.tsx` : 발생 학급/부서 핀포인트 테이블 (병명 클릭 수정, 등교·출근재개/격리 빠른 전환, 삭제)
  * `DiseaseAddDialog.tsx` : 신규 감염병 및 질병 환자 발생 등록 모달 다이얼로그 (학생 검색 / 교직원 입력 지원)
  * `DiseaseEditDialog.tsx` : 담당자 질병명 및 분류 직접 수정 모달 (원본 사유 확인, 빠른 칩 입력, 표준 병명 입력)
  * `DiseaseCertificateDialog.tsx` : 소견서/진단서 사진 원본 확인, 사진 교체 등록 및 보건교사 직권 제출완료/미제출 관리 모달
* **`src/components/teacher/disease/` (교직원 건강/질병 신고 모듈)**:
  * `StaffDiseaseForm.tsx` : 교직원 건강/질병 직접 신고서 작성 폼 (병명 선택, 기간, 소견서 사진 첨부)
  * `StaffDiseaseHistory.tsx` : 내가 신고한 질병 내역 리스트 및 출근완료(완치) 전환 테이블
* **`record-management/` 서브 모듈**:
  * `InputTabContent.tsx` : 신체검사 및 건강기록 측정치 입력 탭
  * `OutputTabContent.tsx` : 학급/학년별 통계 및 결과 통지표 출력 탭
  * `HealthConfigPanel.tsx` : 검사 항목 및 정상 범위 설정 패널
  * `InstitutionDialog.tsx` : 구강/건강검진 외부 의료기관 관리 모달
  * `LocalBadge.tsx` : 보건 공통 검사 상태 표시 배지

### 마. 체육 관리 및 팀 밸런서 (`src/components/pe/`)
* `TeamBalancer.tsx` : AI 기반 자동 팀 밸런서 컨테이너
* **`team-balancer/` 서브 모듈**:
  * `SetupTabContent.tsx` : 종목, 대상 학급, 밸런스 가중치 설정 탭
  * `TeamsTabContent.tsx` : 편성된 팀 목록, 전력 지수, 조정 탭
  * `StudentsTabContent.tsx` : 대상 학생 전력 랭킹 및 명단 탭
  * `StudentMoveDialog.tsx` : 수동 학생 팀 맞교환/이동 모달
  * `ScoutingReportDialog.tsx` : AI 전력 분석 리포트 모달
* `MeasurementManagement.tsx` : PAPS 측정 관리 메인
* `RecordInput.tsx` : PAPS 종목별 수기 기록 입력
* `ClassAnalytics.tsx` : 학급별 체력 분석 통계
* `Ranking.tsx` : 학년/전교 PAPS 랭킹
* `SportsClubManagement.tsx` : 학교 스포츠클럽 관리
* `TournamentManagement.tsx` : 대진표 및 토너먼트 관리

### 바. 학부모 신청서 모바일/데스크탑 서식 (`src/components/parents-apply/`)
* `MobileFormCard.tsx` : 결석계/체험학습/결과보고서 3종 모바일 통합 카드 UI (최대 5개 첨부 지원)
* `DesktopAbsenceForm.tsx` : 데스크탑 결석계 A4 공식 서식 (최대 5개 첨부 지원)
* `DesktopFieldTripForm.tsx` : 데스크탑 교외체험학습 신청서 A4 서식
* `DesktopFieldTripReportForm.tsx` : 데스크탑 교외체험학습 결과보고서 A4 서식
* `AbsenceEditDialog.tsx` : 결석계 직접 수정 다이얼로그 (학부모/담임교사 수정, 독감/감염병 전환, 기간/사유 변경, 최대 5개 첨부 및 전교 4대 시스템 실시간 재동기화)
* `PinModal.tsx` : 학부모 2차 인증 PIN 입력 모달
* `ConfirmSubmitModal.tsx` : 신청서 최종 제출 확인 다이얼로그

### 사. 교원 복무 신청 (`src/components/teacher-duty/`)
* `TravelItemsSection.tsx` : 출장 일정, 목적지, 동행자 관리 섹션
* `StudyAbroadPlanSection.tsx` : 교육공무원법 제41조 국외자율연수 계획서 섹션
* `RepeatTravelDialog.tsx` : 출장 요일 반복 및 동행자 일괄 지정 모달

### 아. 부서 업무 및 주간 교육계획 (`src/components/tasks/`)
* `create-department-task-dialog.tsx` : 부서 업무 기안 다이얼로그
* `TaskTypeConfigSection.tsx` : 업무 유형 및 결재선 설정 섹션
* `EventDetailsSection.tsx` : 행사/일정 세부 사항 입력 섹션
* `create-weekly-proposal-dialog.tsx` : 주간 교육계획안 제출 모달
* `create-weekly-schedule-dialog.tsx` : 주간 주요일정 등록 모달

### 자. 전자결재 및 공통 (`src/components/document-form/`, `src/components/inbox/`)
* `document-form/` : 기안서 폼 컨테이너 및 결재선/공람 다이얼로그
* `inbox/OvertimeBarChart.tsx` : 부서/개인별 초과근무 시간대별 시각화 차트
* `official-document-print.tsx` : 표준 기안문 인쇄 서식
* `parent-document-print.tsx` : 학부모 결석계/체험학습 A4 인쇄 서식

---

## 4. 비즈니스 로직 및 서비스 레이어 (`src/lib/`)

### 가. Firestore 서비스 계층 (`src/lib/services/`)
* `settingsService.ts` : 학교 기본 설정, 조직도, 직책, 학사일정 조회/저장
* `userService.ts` : 교직원 사용자 프로필 및 권한 동기화
* `masterStudentService.ts` : 통합 마스터 학생 DB upsert, 검색, 휴지통 백업
* `homeroomClassService.ts` : 담임 학급 배정 및 학생 목록 서비스
* `homeroomAttendanceSync.ts` : 출석부와 학부모 신청서 실시간 연동
* `documentService.ts` : 전자결재 기안, 승인, 반려, 회수 라이프사이클
* `departmentTaskService.ts` : 부서 업무 및 결재 진행
* `weeklyEducationPlanService.ts` : 주간 교육계획안 관리
* `monthlyEducationPlanService.ts` : 월간 교육계획안 관리
* `peService.ts` : PAPS 측정 기록 및 체육 통계 CRUD
* `healthService.ts` : 보건실 건강기록부 및 신체검사 데이터 CRUD
* `notificationService.ts` : 결재/출결/버스 알림 전송

### 나. 스쿨버스 로직 (`src/lib/kisbus/`)
* `assignments.ts` : 등교/하교/방과후 버스 좌석 배정 엔진
* `buses.ts` : 버스 노선 및 실운행 버스 필터링
* `routes.ts` : 노선 관리 및 정류장 정보
* `students.ts` : 스쿨버스 탑승 학생 매핑 및 연동
* `attendance.ts` : 버스별 일일 출결 기록 ('오늘 안 탐' 연동)
* `firebase.ts` : 보조 Firebase 앱(`kisbusDb`) 초기화

### 다. 체육 및 방과후 로직
* `src/lib/pe/paps.ts` : PAPS 등급 계산 공식 및 체력 등급 산출
* `src/lib/pe/peReportEngine.ts` : 체육 평가 보고서 텍스트 생성
* `src/lib/afterschool/schedule.ts` : 방과후 수업 요일/시간 스케줄 유틸
* `src/lib/afterschool/fareCalculator.ts` : 방과후 수강료 및 버스 요금 계산

---

## 5. 파일맵 유지 및 개발 원칙
1. **핀포인트 접근**: 코드 수정 전 반드시 본 `FILEMAP.md`에서 대상 파일의 경로를 먼저 확인하고 정확한 타겟 파일 1곳만 수정합니다.
2. **파일 변경 시 실시간 동기화**: 신규 파일 추가, 기존 파일의 분리/삭제/이동 발생 시 즉시 본 파일맵의 해당 항목을 갱신합니다.
3. **디렉토리 분리 규칙**: 1,000줄 이상의 거대 컴포넌트는 단일 파일에 방치하지 않고 `src/components/[도메인]/[기능명]/` 하위로 컴포넌트를 분리하여 모듈화합니다.
