# Clawdbot MCP Integration Guide

Clawdbot에서 mcporter를 통해 AI Note MCP 서버에 연결하는 방법을 안내합니다.

## Prerequisites

- Clawdbot이 설치되어 실행 중
- AI Note API Key (앱 설정에서 발급)

## Quick Setup (로컬)

### 1. mcporter 설치

```bash
npm install -g mcporter
```

### 2. mcporter 설정 파일 생성

`~/.mcporter/mcporter.json` 파일을 생성합니다:

```json
{
  "mcpServers": {
    "ainote": {
      "baseUrl": "https://api.ainote.dev/api/mcp",
      "description": "AI Note task management",
      "headers": {
        "Authorization": "McpKey YOUR_API_KEY"
      }
    }
  }
}
```

> **중요**:
> - `YOUR_API_KEY`를 실제 AI Note API Key로 교체하세요
> - 반드시 `mcpServers` 래퍼로 감싸야 합니다
> - 헤더는 `"Authorization": "McpKey <key>"` 형식이어야 합니다 (공백 포함)

### 3. 설정 확인

```bash
mcporter list
```

출력 예시:
```
mcporter 0.7.3 — Listing 1 server(s)
- ainote — AI Note task management (5 tools, 0.8s)
✔ Listed 1 server (1 healthy).
```

### 4. 사용하기

Clawdbot 채팅에서:
```
mcporter call ainote.list_tasks
```

## Docker/NAS Deployment

Docker 환경에서 Clawdbot을 실행하는 경우 추가 설정이 필요합니다.

### 1. 컨테이너 내부에 mcporter 설치

```bash
sudo docker compose exec clawdbot npm install -g mcporter
```

> **참고**: 컨테이너 재시작 시 mcporter가 사라질 수 있습니다. 영구 설치를 위해 Dockerfile을 수정하거나 entrypoint 스크립트에 추가하세요.

### 2. 설정 파일 생성 (두 위치 모두)

mcporter는 여러 위치에서 설정을 찾습니다. **두 위치 모두** 설정해야 합니다:

#### 위치 1: `~/.mcporter/mcporter.json`

```bash
sudo docker compose exec clawdbot mkdir -p /home/node/.mcporter
```

```bash
sudo docker compose exec clawdbot sh -c "echo -n '{\"mcpServers\":{\"ainote\":{\"baseUrl\":\"https://ainote-5muq.onrender.com/api/mcp\",' > /home/node/.mcporter/mcporter.json"
```

```bash
sudo docker compose exec clawdbot sh -c "echo -n '\"description\":\"AI Note task management\",' >> /home/node/.mcporter/mcporter.json"
```

```bash
sudo docker compose exec clawdbot sh -c "echo -n '\"headers\":{\"Authorization\":\"McpKey YOUR_API_KEY\"}}}}' >> /home/node/.mcporter/mcporter.json"
```

#### 위치 2: `~/.clawdbot/mcporter.json`

```bash
sudo docker compose exec clawdbot sh -c "echo -n '{\"mcpServers\":{\"ainote\":{\"baseUrl\":\"https://ainote-5muq.onrender.com/api/mcp\",' > /home/node/.clawdbot/mcporter.json"
```

```bash
sudo docker compose exec clawdbot sh -c "echo -n '\"description\":\"AI Note task management\",' >> /home/node/.clawdbot/mcporter.json"
```

```bash
sudo docker compose exec clawdbot sh -c "echo -n '\"headers\":{\"Authorization\":\"McpKey YOUR_API_KEY\"}}}}' >> /home/node/.clawdbot/mcporter.json"
```

### 3. 확인

```bash
sudo docker compose exec clawdbot mcporter list
sudo docker compose exec clawdbot mcporter call ainote.list_tasks
```

### 4. 호스트에서도 설정 (영구 저장)

Docker 볼륨에 마운트된 config 디렉토리에도 저장하면 컨테이너 재시작 후에도 유지됩니다:

```bash
# NAS 호스트에서 (예: Synology)
echo -n '{"mcpServers":{"ainote":{"baseUrl":"https://ainote-5muq.onrender.com/api/mcp",' > /volume1/docker/clawdbot/config/mcporter.json
echo -n '"description":"AI Note task management",' >> /volume1/docker/clawdbot/config/mcporter.json
echo -n '"headers":{"Authorization":"McpKey YOUR_API_KEY"}}}}' >> /volume1/docker/clawdbot/config/mcporter.json
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_tasks` | 할일 목록 조회 (필터링 지원) |
| `create_task` | 새 할일 생성 |
| `update_task` | 할일 수정 |
| `delete_task` | 할일 삭제 |
| `list_categories` | 카테고리 목록 조회 |

## Tool Examples

### 할일 목록 조회
```
mcporter call ainote.list_tasks
mcporter call ainote.list_tasks status=pending
mcporter call ainote.list_tasks is_important=true
mcporter call ainote.list_tasks overdue=true
mcporter call ainote.list_tasks due_today=true
```

### 할일 생성
```
mcporter call ainote.create_task content="회의 준비하기"
mcporter call ainote.create_task content="프로젝트 마감" is_important=true due_date="2026-01-30"
```

### 할일 완료 처리
```
mcporter call ainote.update_task id="<task-id>" completed_at="2026-01-26T12:00:00Z"
```

### 할일 삭제
```
mcporter call ainote.delete_task id="<task-id>"
```

## Authentication

AI Note API는 두 가지 인증 방식을 지원합니다:

| 키 타입 | 형식 | 헤더 |
|--------|------|------|
| User API Key | 24자 영숫자 | `Authorization: McpKey <key>` |
| MCP Key | 64자 hex | `Authorization: McpKey <key>` |

API Key는 AI Note 앱 설정 > 계정에서 발급받을 수 있습니다.

## Troubleshooting

### "No MCP servers configured"
- mcporter 설정 파일 위치 확인: `~/.mcporter/mcporter.json`
- 파일명이 `mcporter.json`인지 확인 (`config.json` 아님)

### "ZodError: expected record, received undefined"
- 설정 파일에 `mcpServers` 래퍼가 있는지 확인
- 올바른 형식:
  ```json
  {
    "mcpServers": {
      "ainote": { ... }
    }
  }
  ```
- 잘못된 형식:
  ```json
  {
    "ainote": { ... }
  }
  ```

### Demo 데이터만 반환됨 (3개 작업)
- API Key가 올바른지 확인
- 헤더 형식 확인: `"Authorization": "McpKey <key>"` (공백 포함)
- `McpKey: <key>` 형식은 작동하지 않음

### exec failed 오류
- mcporter가 설치되어 있는지 확인: `which mcporter`
- 글로벌 설치: `npm install -g mcporter`

### Telegram에서만 Demo 데이터가 나옴
- Clawdbot 에이전트가 `~/.clawdbot/mcporter.json` 파일도 읽을 수 있음
- 두 위치 모두에 동일한 설정 파일을 생성해야 함:
  1. `~/.mcporter/mcporter.json`
  2. `~/.clawdbot/mcporter.json`

## See Also

- [Claude Desktop Setup](./CLAUDE_DESKTOP_SETUP.md)
- [MCP Features Manual](./MCP_FEATURES_MANUAL.md)
- [AI Note API Documentation](https://api.ainote.dev)
