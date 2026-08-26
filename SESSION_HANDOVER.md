# SESSION HANDOVER — KIS 통합 포털 (KISAPP)

## 1. Current Status (현재 상태)

### 최근 완료 작업

1. **[기존 체험학습 신청서(Yock1GGTdDNRk0NWg2ph) 결재선 교무부장 이관 완료]**
   - 1단계 [담임 (김현희)] : 승인 완료 상태 유지
   - 2단계 [교무부장 (김경훈 / kisekimkeunghun@kshcm.net)] : 결재 대기중(pending, currentStep: 1)으로 즉시 이관
   - 3단계 [교감 (shinedu@kshcm.net)] : 최종 결재권자(final)로 배치

2. **[전결규정 지능형 키워드 매칭(퍼지) 전면 적용 완료]**
   - `userService.ts`: 문서명(subType)이 `체험학습신` 등 축약되거나 띄어쓰기가 달라도 전결규정을 100% 탐색하여 결재선 자동 생성

3. **[학교 리더십에 교무부장(academicHead) 필드 및 UI 추가 완료]**
   - `OrgStructure` 타입에 `academicHead?: string;` 공식 추가 및 조직도 상단 3열 배치 완료

4. **[교직원 vs 학생 명단 원천 이원화 필터링 적용]**
   - 조직도 및 기안문 결재선 검색 전체에 `facultyUsers` 필터 적용

## 2. Context

- Firebase 프로젝트 ID: studio-9153973571-7837c
- 개발 서버: http://localhost:9002 (정상 구동 중)
- 배포 원칙: 사용자 명시적 승인 시만 배포 실행
