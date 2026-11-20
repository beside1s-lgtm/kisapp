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
  * `src/app/api/drive/archive-handover/route.ts` : 학년 말 인수인계(업무 및 비품) 교감 최종 결재 완료 시 Google Drive 인수인계 폴더에 A4 완결 PDF 자동 아카이빙

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
* `ClassManagementTab.tsx` : 학급 관리 종합 탭 (칠판 알림, 숙제 확인, 행동 관찰, 기록·상담, 월별 현황, 자료 공유, 수업 도구 7대 서브탭 오케스트레이션)
* **`class-management/` 서브 모듈**:
  * `HomeworkTabContent.tsx` : 미확인 과제 통합 피드, 시간순 정렬 및 담임 확인 처리
  * `HomeworkArchiveView.tsx` : 확인된 숙제 아카이브 보관함, 학생별 제출 통계/4단계 평가 산출 및 XLSX 다운로드
  * `RecurringHomeworkDialog.tsx` : 정기 과제(반복 과제) 설정 팝업 — 매주/격주/매월 주기, 요일/날짜 선택, 기간 설정, 활성/일시중지 토글, 삭제 관리. 해당 날짜 도달 시 자동 과제 추가 트리거 연동
  * `BehaviorTabContent.tsx` : 학생 행동특성 및 종합의견 기록
  * `MemoTabContent.tsx` : 일일 메모 및 특이사항 관리
  * `MatrixTabContent.tsx` : 학생 평가 매트릭스 뷰
  * `ReviewTabContent.tsx` : 학기말 종합 평가 검토 탭
  * `BehaviorInputDialog.tsx` : 행동 기록 빠른 입력 팝업
  * `EditHomeworkDialog.tsx` : 과제 수정 모달
  * `MemoHistoryDialog.tsx` : 과거 메모 이력 조회 모달
* **`tools/` (수업 도구 종합 서브 모듈)**:
  * `ClassToolsMainTab.tsx` : 수업 도구 메인 컨테이너 (자리 배치, 칭찬, 숙제, 칠판, 뽑기, 팀 나누기 6대 핵심 도구 탭 및 전체화면 오케스트레이션)
  * `PraiseTabContent.tsx` : 칭찬 전용 탭 (우리 반 칭찬 온도계 게이지 및 학생별 10개 단위 보석 티어 칭찬 도장판 그리드, 원터치 칭찬 부여)
  * `RandomPickerTab.tsx` : 1~12명 발표자 및 인원 랜덤 뽑기 탭 (원클릭 칩 선택, 긴장감 넘치는 롤링 셔플 애니메이션, 당첨자 영웅 카드 및 즉시 칭찬 연동)
  * `TeamGeneratorTab.tsx` : 모둠/팀 나누기 탭 (팀 개수/팀당 인원수 분할, 성별 균등 배분, 팀별 컬러 카드, 팀장 랜덤 뽑기, 명단 복사 및 A4 인쇄)
  * `EditTeamModal.tsx` : 모둠/팀 커스텀 설정 모달 (팀 이름 임의 변경, 8대 테마 색상 팔레트 선택, 팀장 수동 변경 및 자리배치 책상 색상 실시간 연동)
* **`seating/` (자리 배치 & 칭찬 관리 서브 모듈)**:
  * `SeatingTabContent.tsx` : 자리 배치 & 칭찬 관리 메인 탭 컨테이너 (배치도 선택/생성/저장/삭제, 뽑기/팀 나누기 슬라이드 다운 탭 바 오케스트레이션, 카운트다운/결과 모달, A4 인쇄/명단 복사)
  * `SeatingBoardView.tsx` : 교실 칠판 및 좌석 그리드 뷰 (우클릭 학생 카드 모달 연동, 팀 나누기 연동 책상 색상 통일 및 팀 배지, 등급 아이콘 연동 별 배지, 룰렛 하이라이트 애니메이션, 사진 숨김 모드 2단 분리)
  * `SeatingPraiseWidget.tsx` : 자리 배치도 내 칭찬 현황 접이식(Collapsible) 위젯 (학급/분단/팀 드롭다운 선택, 실시간 온도계 및 통계 카드, 칭찬 탭 디폴트 뷰 연동)
  * `SeatingPickerBar.tsx` : 자리 배치도 상단 슬라이드 다운 발표자 뽑기 탭 바 (인원수 증감, 성별 필터, 중복 제외, 룰렛 트리거)
  * `PickerResultModal.tsx` : 발표자 뽑기 당첨 결과 축하 팝업 모달 (당첨 학생 대형 카드, 성별/번호, 원터치 칭찬 도장, 다시 뽑기)
  * `SeatingTeamBar.tsx` : 자리 배치도 상단 슬라이드 다운 팀 나누기 탭 바 (나누기 방식/팀 수 선택, 팀별 명단 보기 메뉴, 팀 나누기 실행)
  * `TeamResultModal.tsx` : 팀 나누기 결과 팝업 모달 (각 팀별 이름, 색상 팔레트, 팀원 목록 및 자리배치도 실시간 색상 연동 확인)
  * `TeamListModal.tsx` : 팀별 상세 명단 확인 및 팀 이름/색상 수정 모달
  * `StudentDetailModal.tsx` : 좌석 우클릭 시 화면 중앙 대형 학생 정보 카드 및 수업·학급 관리 톱니바퀴 모달 (대형 프로필/아바타, 번호/성명/성별/팀 배지, 칭찬 게이지, 관리 4대 탭: 내 PC 사진 파일 직접 등록 및 용량 자동 최적화/16종 캐릭터 아바타 등록/복원, 과제 제출 토글/통계, 칭찬 점수/사유 가산, 상담·관찰 일지 등록/열람/삭제)
  * `PraiseModal.tsx` : 좌석 클릭 시 학생 칭찬 포인트 부여/차감(+1, +2, +3, +5, -1), 칭찬 등급 직관적 아이콘(새싹/줄기/꽃봉오리/열매/나무/황금숲) 표출, 칭찬 사유 태그 및 좌석 고정/이동/비우기 관리 모달
  * `PraiseGaugeBar.tsx` : 학급 전체/분단별/모둠별 3대 뷰 전환 칭찬 온도계 프로그레스 바, 다주기(오늘/이번주/월간/학기/연간) 목표 드롭다운 선택 및 목표 점수 설정 팝오버, 실시간 집계 게이지 & 1등 왕관 배지 바
  * `PraiseGrowthSettingModal.tsx` : 칭찬 시스템 관리 통합 모달 (칭찬 성장 체계/티어 가이드 탭 & 포인트 통장 및 보상 관리 탭 2분할 제공)
  * **`reward/` 서브 모듈 (포인트 통장 및 보상 관리)**:
    * `RewardManagerTab.tsx` : 학급 포인트 통장 & 보상 관리 메인 탭 컨테이너 (포인트 통장 현황, 보상 아이템 목록, 거래 내역 3대 서브 탭 제어)
    * `AccountListSubTab.tsx` : 학생별 포인트 통장 잔액 현황, 시중 유통 포인트 통계, 보상 교환 처리 및 포인트 수동 지급/차감 모달
    * `RewardItemSettingSubTab.tsx` : 교사 보상 아이템 목록 설정 (쿠폰, 특권, 상품 등 아이템 추가/수정/삭제, 활성화 토글, 기본 추천 보상 복원)
    * `TransactionHistorySubTab.tsx` : 포인트 적립(+), 보상 교환 소비(-), 수동 조정 내역 시간순 타임라인 및 필터 검색
  * **`promotion/` 서브 모듈 (칭찬 성장 등급 승급 축하 순차 팝업)**:
    * `PraisePromotionModal.tsx` : 등급 승급 축하 팝업 모달 (복수 승급 시 등급별 그룹화, 높은 등급부터 순차 팝업 큐 제어, 학생 사진/이름/승급 등급/축하 멘트)
    * `ConfettiCanvas.tsx` : 모달 오픈 시 화면 전면 화려한 축하 폭죽 파티클 렌더링 캔버스 엔진
  * `SeatingDisplayToggles.tsx` : 자리배치도 내 칭찬 현황 바 및 책상 등급 노출 여부를 제어하는 컴팩트 토글 컨트롤러
  * `ViewOptionsPopover.tsx` : 학생 사진, 칭찬 포인트, 모둠/학급 게이지, 성별 배지 표시 여부를 켜고 끄는 선택적 보기 설정 팝오버
  * `SeatingConfigModal.tsx` : 자리배치도 대형 설정 모달 (분단형, 모둠형, 자유형 3대 대형, 짝꿍 성별 설정, 결과보기 효과 선택)
  * `StudentAssignModal.tsx` : 좌석 사전 지정(고정 핀) 및 학생 수동 배정/고정 해제/비우기 모달
  * `CountdownOverlay.tsx` : 3, 2, 1 카운트다운 및 줄바꿈 없는 고급 '배정 완료!' 축하 카드 오버레이 애니메이션
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
* `PapsReportPrintDialog.tsx` : PAPS 학생 체육 성장 리포트 A4 인쇄 다이얼로그 (GloNaCal 테마, 5대 요인 레이더 차트, 학교 심볼 로고 탑재)
* `kisSymbolBase64.ts` : PAPS 성장 리포트 전용 호치민시한국국제학교 공식 심볼 로고 Base64 에셋
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

### 자. 시스템 설정 및 조직도 (`src/components/settings/`, `src/components/settings-modal.tsx`)
* `settings-modal.tsx` : 시스템 환경설정 메인 모달 (일반, 학사일정, 조직도, 전결규정, 사용자, 감사로그 탭 통합 관리, 교직원 테이블 내 '서명/도장' 컬럼 및 서명 등록/미등록 필터, '담당 시설(학급)' 컬럼·배지 표출)
* `settings/OrgSettingsTab.tsx` : 조직도 관리 메인 탭 (학교 리더십, 업무 담당, 학년별 담임/교과, 부서 관리, 시설 및 학급 5대 서브탭 오케스트레이션)
* `settings/FacilitiesOrgTab.tsx` : [시설 및 학급] 전용 조직도 서브탭 (학교 전체 시설/학급 등록·수정·삭제, 순수 교직원 인라인 담당 배정, 차년도 학급 및 시설 매핑 토글, 2026년 시설/담당자 ➔ 2027년 시설/인수자 4단 확장 헤더 테이블 및 일괄 저장 지원)
* `settings/TeacherSignatureProxyModal.tsx` : 교직원 서명/도장 확인 및 대리 등록 모달 (실제 서명 판별 및 검증, 결재란 직인 날인 예시 시뮬레이션, 도장/서명 사진 초경량 투명화 최적화, 직접 그리기 서명패드 및 대리 등록·삭제 지원)

### 차. 학년 말 인수인계 및 비품 인계서 (`src/components/handover/`)
* `src/app/(app)/teacher/handover/page.tsx` : 학년 말 인수인계 통합 메인 페이지 (업무 인수인계 vs 비품 인수인계 2대 메인 모드 탭, 교무부장/관리자 전용 상단 인수인계 제어 토글 `[열림(잠그기)] / [잠김(열기)]`, 전역 마감 배너 및 잠금 상태 하위 전파)
* **`src/components/handover/fixture/` (학급・특별실 비품 인수인계 모듈)**:
  * `FixtureHandoverMainTab.tsx` : 비품 인수인계 종합 대시보드 및 서브탭 (잠금 상태 연동, 제출 완료 전용 뷰/회수 액션 전환, 내 작성/수정, 수신 비품 목록, 교무부장 총괄 확인, 교감 최종 결재, 전체 목록)
  * `FixtureHandoverEditor.tsx` : 비품 인계서 작성/수정 에디터 (시스템 설정 [시설 및 학급] 실시간 연동, 특별실 검색 및 정식 시설 칩 선택기, 윈도우 비밀번호 가로 행 입력, 교원 전용 후임 인수자 자동완성 검색, 잠금 시 비활성화)
  * `FixtureHandoverViewer.tsx` : 비품 인계서 상세 뷰어 (A4 인쇄 미리보기, 인계자 제출 회수 기능, 3단계 인계・인수・입회 전자 서명 날인 현황 카드, 잠금 시 회수/수정 차단)

### 카. 전자결재 및 공통 (`src/components/document-form/`, `src/components/inbox/`)
* `document-form/` : 기안서 폼 컨테이너 및 결재선/공람 다이얼로그
* `inbox/OvertimeBarChart.tsx` : 부서/개인별 초과근무 시간대별 시각화 차트
* `official-document-print.tsx` : 표준 기안문 인쇄 서식
* `parent-document-print.tsx` : 학부모 결석계/체험학습 A4 인쇄 서식
* `document-view/AttachmentViewerModal.tsx` : 결석계 증빙서류(진단서/소견서/처방전) 이미지 및 PDF 원본 모달 뷰어
* `document-view/EvidenceAttachmentSection.tsx` : 결재 상세 화면 내 첨부 증빙서류 전용 카드, 용량/확장자 표시 및 미리보기/새창/다운로드 연동

---

## 4. 비즈니스 로직 및 서비스 레이어 (`src/lib/`)

### 가. Firestore 서비스 계층 (`src/lib/services/`)
* `settingsService.ts` : 학교 기본 설정, 조직도, 직책, 학사일정 조회/저장
* `userService.ts` : 교직원 사용자 프로필 및 권한 동기화
* `safetyService.ts` : 학교 시설 및 학급 점검 대장, 월별 안전점검표, 교사 이메일 자동 매칭 보강
* `fixtureHandoverService.ts` : 학급・특별실 비품 인수인계 CRUD, 문서 회수(recallFixtureDocument), 품목 지속 템플릿 학습, 전자서명/직인도장 자동 날인, 교감 최종 입회 및 Google Drive 완결 PDF 자동 아카이빙 연동, A4 인쇄 HTML 생성
* `handoverLockService.ts` : 학년 말 인수인계 전역 잠금/해제(Firestore `settings/handover_lock_{year}` SSOT) 관리, 교감 최종 결재 완료 시 자동 잠금 및 교무부장(관리자) 재오픈 토글 제어 서비스
* `handoverService.ts` : 교원 업무 인수인계 기안문서 자동 연동, 후임자 자동 라우팅, 교무부장 일괄 상신, 교감 최종 결재 및 Google Drive 완결 PDF 자동 아카이빙 연동
* `masterStudentService.ts` : 통합 마스터 학생 DB upsert, 검색, 휴지통 백업
* `homeroomClassService.ts` : 담임 학급 배정 및 학생 목록 서비스
* `homeroomAttendanceSync.ts` : 출석부와 학부모 신청서 실시간 연동
* `documentService.ts` : 전자결재 기안, 승인, 반려, 회수 라이프사이클
* `departmentTaskService.ts` : 부서 업무 및 결재 진행
* `weeklyEducationPlanService.ts` : 주간 교육계획안 관리
* `monthlyEducationPlanService.ts` : 월간 교육계획안 관리
* `peService.ts` : PAPS 측정 기록 및 체육 통계 CRUD
* `seatingService.ts` : 학급 랜덤 자리 배치 CRUD (Firestore `homeroom_classes/{classKey}/seating_plans` SSOT), 사전 고정 좌석 보존 알고리즘, 성별 짝꿍 매칭(이성/동성/랜덤), 이전 짝꿍 중복 방지
* `healthService.ts` : 보건실 건강기록부 및 신체검사 데이터 CRUD
* `notificationService.ts` : 결재/출결/버스 알림 전송
* `src/lib/types/teams.ts` : 학급 팀 나누기 모델, 8대 테마 색상 팔레트 및 로컬 동기화 헬퍼
* `src/lib/types/avatars.ts` : 학급 전용 학생 캐릭터 아바타(16종 프리셋) 및 직접 등록 사진(Base64) 모델, 로컬 스토리지 헬퍼
* `src/lib/utils/imageOptimizer.ts` : 브라우저 Canvas 기반 학생 아바타 사진(1:1 중앙 크롭) 및 교직원 서명/도장(종횡비 보존 투명 PNG, <30KB) 자동 최적화 압축 유틸
* `src/lib/types/seating.ts` : 자리배치도 3대 대형 설정 모델, 좌석 슬롯, 칭찬 티어/성장 단계 계산 엔진
* `src/lib/types/praiseReward.ts` : 칭찬 보상 아이템, 학생별 소비형 포인트 통장(잔액/누적), 거래 내역 타입 모델
* `src/lib/types/praisePromotion.ts` : 칭찬 성장 등급 승급 학생 정보 및 등급별 순차 그룹 모델
* `src/lib/services/praiseRewardService.ts` : 보상 아이템 CRUD, 학생 계좌 싱크, 칭찬 적립/보상 소비/수동 입출금 및 거래 내역 영속화 엔진
* `src/lib/services/praisePromotionStore.ts` : 승급 판별 평가 및 등급별 승급 이벤트 발행 버스

### 나. 스쿨버스 로직 (`src/lib/kisbus/`)
* `assignments.ts` : 등교/하교/방과후 버스 좌석 배정 엔진
* `buses.ts` : 버스 노선 및 실운행 버스 필터링
* `routes.ts` : 노선 관리 및 정류장 정보
* `students.ts` : 스쿨버스 탑승 학생 매핑 및 연동
* `attendance.ts` : 버스별 일일 출결 기록 ('오늘 안 탐' 연동)
* `firebase.ts` : 보조 Firebase 앱(`kisbusDb`) 초기화

### 다. 체육 및 방과후 로직
* `src/lib/pe/paps.ts` : PAPS 등급 계산 공식, 4~6학년 남/여 BMI 공식 기준표 및 체력 등급 산출
* `src/lib/pe/papsReportCommentEngine.ts` : PAPS 학생 성장 리포트 맞춤형 4대 총평/칭찬/처방 및 BMI 가이드 생성 엔진
* `src/lib/pe/peReportEngine.ts` : 체육 평가 보고서 텍스트 생성
* `src/lib/afterschool/schedule.ts` : 방과후 수업 요일/시간 스케줄 유틸
* `src/lib/afterschool/fareCalculator.ts` : 방과후 수강료 및 버스 요금 계산

### 라. 전역 디자인 시스템 및 학교 공식 브랜드 컬러
* `src/app/globals.css` : 학교 공식 브랜드 컬러 3종(:root `--primary-color: #2471B2`, `--secondary-color: #B01E23`, `--accent-color: #C49832`) 및 ShadCN UI 시맨틱 HSL 토큰 정의
* `tailwind.config.ts` : Tailwind CSS 설정 및 `brand` 확장 팔레트(brand.blue, brand.red, brand.gold) 토큰 등록
* `src/components/ui/` : Button, Badge, Tabs, Alert 등 브랜드 테마와 동기화된 기본 원자 컴포넌트
* `src/components/ui/signature-pad.tsx` : Pointer Events 기반 High-DPI(레티나) 지원, 무오차 좌표 보정 및 자체 트림(Trim) 알고리즘을 내장한 전자 서명 컴포넌트

---

## 5. 파일맵 유지 및 개발 원칙
1. **핀포인트 접근**: 코드 수정 전 반드시 본 `FILEMAP.md`에서 대상 파일의 경로를 먼저 확인하고 정확한 타겟 파일 1곳만 수정합니다.
2. **파일 변경 시 실시간 동기화**: 신규 파일 추가, 기존 파일의 분리/삭제/이동 발생 시 즉시 본 파일맵의 해당 항목을 갱신합니다.
3. **디렉토리 분리 규칙**: 1,000줄 이상의 거대 컴포넌트는 단일 파일에 방치하지 않고 `src/components/[도메인]/[기능명]/` 하위로 컴포넌트를 분리하여 모듈화합니다.
