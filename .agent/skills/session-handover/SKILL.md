---
name: session-handover
description: 작업을 종료하거나 새로운 세션을 시작할 때, 이전 작업 컨텍스트를 복구하거나 인수인계 문서를 생성할 때 사용
---

# 세션 관리 지침

## 1. 세션 복구 (새 세션 시작 시)
- `Filesystem` MCP로 루트 디렉토리의 `SESSION_HANDOVER.md`를 즉시 읽고 이전 작업 내역과 상태를 복구한다.

## 2. 세션 종료 ("작업 종료", "나중에 이어서" 등 요청 시)
- 루트 디렉토리에 `SESSION_HANDOVER.md`를 생성하거나 업데이트한다.
- 필수 포함 항목:
  - Current Status (현재 상태)
  - Modified Files (수정된 주요 파일)
  - Next Steps (다음 작업 목표)
  - Important Context (핵심 컨텍스트)
