# 📋 SESSION HANDOVER (방과후학교 및 전자결재 통합 관리 시스템)

## 1. Current Status (현재 상태)
이번 세션에서는 방과후학교 운영 종료 단계 제어, 강사 출석부·출근부의 프로필 공식 직인 날인 연동, 관리자 서류 검토 팝업, 강사료 수당 산정 공식 정상화, 종합 엑셀 취합본 개편, 그리고 결강 시 보결(대강) 등록 및 수당 분리 지급 체계를 완성했습니다.

### 이번 세션 달성 주요 목표:
1. **운영 종료(`CLOSED`) 단계 통제 및 권한 제어**:
   - 마스터 단계가 `CLOSED`일 때 신규 강좌 개설 차단, 강좌 카드 및 필터 탭 뱃지(`[운영종료]`) 실시간 동기화.
2. **프로필 공식 서명 및 도장(직인 인영) 날인 시스템**:
   - 사용자 프로필에 등록된 실제 서명/도장 사진(`profile.signature`)을 출석부·강사출근부·A4 인쇄 모달·관리자 검토 팝업에 완벽히 매핑.
   - 학생 출결 체크 시 해당 수업일자의 강사출근부에 실시간으로 직인 도장이 자동 날인되는 구조 확립.
   - 부장/교감 전자결재 승인 시 결재 직인 자동 날인.
3. **관리자 제출 서류(출석부, 출근부, 지출증빙) 검토 뷰어 팝업**:
   - 관리자 패널에서 강좌별 제출 현황 뱃지(`[출석부 제출]`, `[출근부 제출]`, `[지출증빙 제출]`) 및 **미제출 상태 뱃지(`[출근부 미제출 (보결/조회)]`, `[출석부 미제출 (조회)]`)** 클릭 시 공식 A4 검토 팝업 표출 및 즉시 인쇄(`window.print()`) 지원.
4. **강사료 수당 계산식 정상화**:
   - 기존 학생 수가 곱해지던 오류를 제거하고, **학생 수와 무관하게 `강좌별 총 수업 차시 × 차시당 강사료 단가(VND)`로 정확히 계산**되도록 수정.
5. **결과 보고 및 수당 청구용 3대 종합 시트 통합 엑셀 워크북 개편**:
   - 붙임파일(`.xlsx`)을 단순 계산표에서 실제 증빙이 포함된 **[시트1: 강사료정산_총괄표], [시트2: 출석부_취합본], [시트3: 강사출근부_취합본]** 멀티 시트 엑셀로 전면 개편.
6. **결강 보결(대강) 등록 및 수당 분리 책정 시스템**:
   - 강사출근부 및 관리자 검토 팝업에서 회차별 **`[보결 등록/수정]`** 버튼 지원.
   - 보결 등록 시 해당 회차에 `[보결] 보결강사명 [직인 도장]` 자동 날인 및 결강 사유 표기.
   - 학기말 정산 시 원 강사 수당(보결 차시 차감)과 보결 강사 수당(대강 차시 지급)이 독립 행으로 자동 분리 계산되어 엑셀 및 기안문에 반영.

---

## 2. Modified Files (수정된 주요 파일)

| 파일 경로 | 수정 사유 및 주요 변경 내용 |
| :--- | :--- |
| [`src/lib/afterschool/types.ts`](file:///c:/myapp/kisapp/src/lib/afterschool/types.ts) | `SubstituteRecord` (보결 기록 인터페이스) 추가, `SubmittedApprovalDoc` 서명 메타데이터 확장 |
| [`src/lib/services/settingsService.ts`](file:///c:/myapp/kisapp/src/lib/services/settingsService.ts) | `afterschool_substitutes` 컬렉션 실시간 리스너 및 CRUD 함수(`onSubstituteRecordsUpdate`, `saveSubstituteRecord`, `deleteSubstituteRecord`) 구현 |
| [`src/lib/afterschool/excel.ts`](file:///c:/myapp/kisapp/src/lib/afterschool/excel.ts) | `generateAfterschoolSettlementWorkbook`, `exportAfterschoolSettlementWorkbook` 구현 (강사료정산 총괄표, 출석부 취합본, 강사출근부 취합본 멀티 시트 생성 및 보결 강사 수당 분리 책정 로직 반영) |
| [`src/components/afterschool/teacher/AttendanceManagement.tsx`](file:///c:/myapp/kisapp/src/components/afterschool/teacher/AttendanceManagement.tsx) | `OfficialSeal` 컴포넌트 추가, 실제 프로필 직인 도장 날인, 학생 출결 체크 연동 실시간 날인, 보결 등록 모달 및 회차별 보결자 도장 표출 |
| [`src/components/afterschool/teacher/AdminPanel.tsx`](file:///c:/myapp/kisapp/src/components/afterschool/teacher/AdminPanel.tsx) | 제출/미제출 서류 뱃지 클릭 시 서류 상세 검토 팝업 호출, 출석부/출근부/지출증빙 뷰어 구현, 관리자 패널 내 보결 등록/수정 팝업 및 출근부 보결 날인 연동 |
| [`src/components/document-form.tsx`](file:///c:/myapp/kisapp/src/components/document-form.tsx) | 결과 보고 기안문 강사료 계산식 정상화(총차시 × 단가), 서류 제출 현황 요약 기안문 반영, 3대 종합 시트 통합 엑셀 다운로드 연동, 보결 기록 데이터 파이프라인 연결 |

---

## 3. Next Steps (다음 작업 목표)

1. **학부모/학생 수강신청 실시간 운영 테스트 및 추가 피드백 대응**:
   - 학기말 정산 결과 보고 기안문 상신 및 최종 결재 완료 시 아카이빙 동작 확인.
2. **다국어(영어, 베트남어) 번역 키 누락 여부 최종 점검**:
   - 보결 등록 모달 및 서류 검토 팝업 내 텍스트의 다국어 사전 반영 상태 확인.
3. **스쿨버스 및 방과후 출결 연동 상태 지속 모니터링**:
   - 출석부 체크 시 kisbus 노선 탑승/하차 실시간 상태 업데이트 정상 작동 검증.

---

## 4. Important Context (핵심 컨텍스트)

- **강사료 산정 원칙**: 강사료는 학생 수와 무관하게 **`총 수업 차시 × 차시당 단가(VND)`**로 계산됩니다. 보결이 있는 경우 `(총 차시 - 보결 차시) × 단가`는 원강사에게, `보결 차시 × 단가`는 보결강사에게 분리 청구됩니다.
- **도장 날인 우선순위**: 사용자가 프로필에 서명/직인 이미지(`profile.signature`)를 등록한 경우 해당 원본 사진이 우선 날인되며, 미등록 시 붉은색 학교 표준 직인 뱃지(`OfficialSeal`)로 자동 폴백됩니다.
- **출근부 도장 날인 트리거**: 학생 출석부에서 해당 회차의 출결(`O`, `V`, `X`)을 1건이라도 체크하는 순간 `attendanceRecords`에 저장되며 강사출근부의 해당 날짜에 직인 도장이 자동으로 찍힙니다.
- **TypeScript 빌드 검증**: `npx tsc --noEmit` 전체 검사 완료 (Exit Code 0).
