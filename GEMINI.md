# Workspace Rules (KISAPP)

## Firebase 프로젝트 격리 및 배포 안전 규칙
1. **프로젝트 ID 바인딩 확인**:
   - Firebase 관련 작업(보안 규칙 배포, Functions, Firestore 조회 등)을 수행할 때는 절대 MCP의 기본 세션 값에 의존하지 않는다.
   - 작업 시작 전 반드시 현재 워크스페이스의 `.firebaserc` 또는 `firebase.json`에서 정확한 `projectId`를 확인하고, `firebase_update_environment`를 통해 현재 프로젝트 디렉토리와 `active_project`를 1:1로 일치시킨다.
2. **배포 시 명시적 프로젝트 플래그 필수**:
   - CLI 명령어로 Firebase 배포(`deploy`)를 실행할 때는 반드시 `--project <프로젝트ID>` 플래그를 명시하여 타 프로젝트로의 오배포를 원천 차단한다.
3. **배포 승인 규칙**:
   - 사용자의 명시적인 배포 승인("배포해", "배포해줘")이 있을 때만 원격 푸시 및 배포 명령을 실행한다.
