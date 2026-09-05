---
name: firebase-ops
description: Firebase 배포, 보안 규칙 수정, Functions 작성, Firestore 조회 등 Firebase 관련 작업을 수행할 때 사용
---

# Firebase 안전 지침

1. **프로젝트 ID 검증:**
   - 기본 세션 값에 절대 의존하지 않는다.
   - 시작 전 `.firebaserc` 또는 `firebase.json`의 `projectId`를 확인하고 active_project를 일치시킨다.
2. **배포 플래그 강제:**
   - 배포 명령어 실행 시 반드시 `--project <해당_프로젝트ID>` 플래그를 명시한다.
   - 사용자의 명시적인 배포 승인("배포해", "배포해줘")이 있을 때만 배포를 실행한다.
3. **데이터 검증:**
   - 데이터 로직 수정 후 Firebase / Google Cloud Firestore MCP로 실시간 쿼리 결과를 검증한다.
