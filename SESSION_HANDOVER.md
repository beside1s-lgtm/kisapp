# 📋 SESSION HANDOVER (KIS 통합 포털 & 전자결재 / 방과후 / 스쿨버스)

---

## 1. Current Status (현재 상태)
이번 세션에서는 사용자의 요청에 따라 다음 주요 항목들을 완벽하게 구현 및 검증 완료했습니다:

1. **위임전결규정 시스템 전면 구축 및 Firestore 연동 완비**:
   - `DelegationRule` 모델 설계: 대분류(`category`/`mainType`), 중분류(`subType`, 문서명), 소분류(`detailType`, 조건), 중간결재자(`NONE` | `GRADE_HEAD` | `ACADEMIC_HEAD` | `DEPT_HEAD`), 최종결재권자(`GRADE_HEAD` | `ACADEMIC_HEAD` | `DEPT_HEAD` | `VP` | `PRINCIPAL`).
   - 기본 규정 8종(결석계, 체험학습신청서, 연간계획공문, 세부계획공문, 휴가, 출장 등) 탑재 및 Firestore 동기화.
   - `settings-modal.tsx`: 시스템 설정 [전결규정] 탭의 테이블 UI 확장, 결재선 미리보기 배지, 실시간 자동 저장, 엑셀 템플릿 다운로드/업로드, [기본 규정 초기화] 버튼 연동.
   - `userService.ts`: `getApproversByGradeClass`에서 시스템 설정의 `delegationRules`를 조회하여 학교별 전결규정(담임 ➡️ 학년부장 전결, 담임 ➡️ 교무부장 ➡️ 교감 전결 등)에 맞게 동적 결재선 완벽 생성.
   - `document-form.tsx`: 일반 기안문 작성 시 상단 `[기본 기안문(교장 결재)]`, `[연간계획공문(교장 결재)]`, `[세부계획공문(교감 전결)]` 템플릿 버튼 및 전결규정 셀렉트 박스 연동.

2. **학부모 문서 처리 및 삭제 권한의 핵심 원인 규명 및 클라우드 배포 완료([`firestore.rules`](file:///c:/myapp/kisapp/firestore.rules))**:
   - **핵심 원인 발견**: 
     1) Firebase MCP 환경이 타 프로젝트(`bromans-29654720-48771`)로 타겟팅되어 있어, 수정된 보안 규칙이 실제 운영 프로젝트인 **`studio-9153973571-7837c` (KISH Approval System)**에 반영되지 않았던 문제를 발견.
     2) Firestore CLI(`firebase-tools`)를 통해 실제 프로젝트 `studio-9153973571-7837c`에 최신 `firestore.rules`를 100% 직접 배포 완료 (`cloud.firestore: released rules firestore.rules`).
     3) `allow delete: if resource.data.get('status', '') != 'approved';`를 적용하여 결재 승인 완료 문서를 제외한 **대기/회수/반려/임시저장 문서의 삭제를 결재자 상관없이 즉시 허용**.
     4) `getMyParentDocuments`, `getStudentFieldTripDays`, `getStudentAbsenceDays`의 복합 쿼리를 단일 필터 및 메모리 필터링 방식으로 개선하여 인덱스 누락으로 인한 런타임 권한 거부 오류 원천 차단.

3. **교직원 기본 직책 목록 정리 및 정렬 Null-Safety 전면 보강([`settings-modal.tsx`](file:///c:/myapp/kisapp/src/components/settings-modal.tsx), [`profile-modal.tsx`](file:///c:/myapp/kisapp/src/components/profile-modal.tsx))**:
   - 학교 업무 체계에 맞추어 기본 직책 목록에서 중복/혼선을 유발하던 `'부장'`을 제거하고 `['교사', '교감', '교장', '행정실장', '주무관', '담당']`으로 표준화 (부장 보직은 [조직도]에서 학년부장/부서부장으로 관리 및 실시간 소속 표기).
   - `fetchUsers` 시 `localeCompare` 런타임 TypeError 원천 방지.

4. **학년별 교과(전담) 교사 배정 및 직관적인 토글 UI 개편([`types.ts`](file:///c:/myapp/kisapp/src/lib/types.ts), [`settings-modal.tsx`](file:///c:/myapp/kisapp/src/components/settings-modal.tsx))**:
   - `OrgStructure` 모델에 `gradeSubjects?: { [grade: string]: string[] }` 필드 추가.
   - [조직도] 탭의 학년 배정 영역을 긴 드롭다운 방식에서 **`[담임] / [교과]` 직관적인 세그먼트 토글 버튼**으로 개편:
     - `[담임]` 선택 시: 반 번호 입력 및 학년부장 스위치 활성화.
     - `[교과]` 선택 시: 불필요한 반 번호 및 학년부장 스위치가 숨겨지고 깔끔하게 학년 + 교사 선택으로 즉시 배정.
   - `5학년 교과` 등으로 배정 시 사용자 목록 및 소속에 `5학년 교과`로 자동 표기 연동.
   - 학년 조직도 목록에 담임 카드와 교과 카드(스카이 블루 배지)를 학년별로 함께 시각화하여 직관적 관리 및 삭제 지원.
   - 엑셀 일괄 등록 템플릿 및 업로더에서도 `반` 항목에 `'교과'` 입력 시 자동 처리 연동.

5. **로컬 프로덕션 빌드 및 개발 서버 검증**:
   - `npm run build` 테스트 통과 (Exit code: 0, 총 39개 라우트 정상 생성).
   - 개발 서버 재기동 및 브라우저 콘솔 오류 `0건` 확인.

---

## 2. Modified Files (수정된 주요 파일)

| 파일 경로 | 수정 사유 및 변경 내역 요약 |
| :--- | :--- |
| [`src/components/settings-modal.tsx`](file:///c:/myapp/kisapp/src/components/settings-modal.tsx) | 사용자 직책 옵션에서 '부장' 제거 및 교사/교감/교장/행정실장/주무관/담당 표준화, `fetchUsers` null-safe 정렬 |
| [`src/components/profile-modal.tsx`](file:///c:/myapp/kisapp/src/components/profile-modal.tsx) | 프로필 설정 내 직책 선택 목록 표준화 |
| [`firestore.rules`](file:///c:/myapp/kisapp/firestore.rules) | `getEmail`, `isAdmin` null-safe 처리, `docType == 'parent'` 및 `parentFormData` 기반 대기/회수/반려 문서 삭제/수정 권한 최우선 보장 및 클라우드 배포 |
| [`src/lib/types.ts`](file:///c:/myapp/kisapp/src/lib/types.ts) | `DelegationRule` 인터페이스 확장 (`intermediateApprover`, `finalApprover`, `category`, `description`) |
| [`src/lib/services/settingsService.ts`](file:///c:/myapp/kisapp/src/lib/services/settingsService.ts) | `DEFAULT_DELEGATION_RULES` 8종 기본 프리셋 및 `getDelegationRules`, `saveDelegationRules` 구현 |
| [`src/lib/services/userService.ts`](file:///c:/myapp/kisapp/src/lib/services/userService.ts) | `getApproversByGradeClass`에서 `delegationRules`를 실시간 조회하여 학교별 동적 결재선 조립 |
| [`src/components/document-form.tsx`](file:///c:/myapp/kisapp/src/components/document-form.tsx) | 기안문 상단 전결규정 빠른 템플릿(연간계획/세부계획/기본) 버튼 및 전결규정 셀렉트 박스 연동 |
| [`src/lib/services/documentService.ts`](file:///c:/myapp/kisapp/src/lib/services/documentService.ts) | `deleteDocument`에서 학부모 문서(`parentFormData` 포함) 삭제 권한 및 null-safety 완비 |
| [`src/components/document-view.tsx`](file:///c:/myapp/kisapp/src/components/document-view.tsx) | 학부모 문서 열람 권한 및 상세 화면 삭제/수정 버튼 노출 조건 강화 |
| [`src/app/parents/apply/page.tsx`](file:///c:/myapp/kisapp/src/app/parents/apply/page.tsx) | `getApproversByGradeClass` 호출 시 명시적 문서명 전달 연동 |

---

## 3. Next Steps (다음 작업 목표)
- 사용자의 피드백에 따른 추가 기능 개발 및 운영 지원.
- 배포 요청(`"배포해"`, `"배포해줘"`) 시 `git push origin main` 원격 배포 진행.

---

## 4. Important Context (핵심 컨텍스트)
- **배포 절대 원칙**: 사용자가 명시적으로 `"배포해"` 또는 `"배포해줘"`라고 지시하기 전에는 원격 푸시(`git push origin main`)나 배포 명령어를 절대 실행하지 않는다.
- **디자인/UI 규칙 (Rule 6)**: 제목 & 설명 한 줄 표기 및 넓은 영역 확보, 버튼 하단 나란히 배치, 디스플레이 크기별 반응형 최적화 유지.
