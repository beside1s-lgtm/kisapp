---
name: kis-pre-deploy-checklist
description: Firebase 배포 전 빌드 검증, TypeScript 타입 오류 검사, 프로젝트 ID 바인딩 확인 및 안전 배포를 진행할 때 사용
---

# Firebase 배포 전 무결성 점검 워크플로우

## 1. 사전 Git 변경점 검토
- `Git` MCP 또는 터미널 명령으로 작업 디렉터리 상태를 확인한다:
  - `git status`: 커밋되지 않은 임시 파일이나 의도치 않은 변경점이 없는지 검사
  - `git diff`: 최근 수정한 핵심 로직에 사이드 이펙트가 없는지 재검토

## 2. 프로덕션 빌드 무결성 검증
- 배포 전 반드시 Next.js 프로덕션 빌드를 실행하여 컴파일 및 타입 에러를 전수 점검한다:
  - `npm run build`
  - 에러 발생 시 즉시 중단하고 원인을 수정한 뒤 재빌드한다. 빌드 실패 상태에서는 절대 배포하지 않는다.

## 3. Firebase 프로젝트 ID 격리 검증
- `.firebaserc` 및 `firebase.json`을 조회하여 현재 워크스페이스의 정확한 `projectId`를 확인한다.
- 타 프로젝트로의 오배포를 원천 차단하기 위해 기본 세션 값에 의존하지 않는다.

## 4. 명시적 사용자 승인 확인
- 사용자의 명시적인 배포 승인("배포해", "배포해줘")이 존재하는지 반드시 확인한다.
- 승인 없이 독자적으로 배포 명령을 실행하지 않는다.

## 5. 배포 플래그 강제 실행
- 배포 명령 실행 시 반드시 `--project <프로젝트ID>` 플래그를 명시한다:
  - `firebase deploy --only hosting --project <프로젝트ID>`
  - Functions 배포 시: `firebase deploy --only functions --project <프로젝트ID>`
- 배포 후 호스팅 URL에 접속하여 주요 페이지(인박스, 학부모 메인, 방과후 등)의 200 OK 상태를 확인한다.
