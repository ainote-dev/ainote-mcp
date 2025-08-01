# Claude Desktop과 AI Note 연동 가이드

## 1. MCP Key 발급받기

1. AI Note 웹 사이트에 로그인합니다
2. 설정 > MCP 키 관리로 이동합니다
3. "새 MCP 키 생성" 버튼을 클릭합니다
4. 키 이름과 설명을 입력합니다 (예: "Claude Desktop")
5. 생성된 키를 안전한 곳에 복사해둡니다 (다시 표시되지 않습니다)

## 2. MCP Proxy 설치

### npm을 통한 설치 (권장)
```bash
npm install -g @ainote/mcp
```

### 수동 설치
```bash
git clone https://github.com/ainote-dev/ainote-mcp.git
cd ainote-mcp
npm install
```

## 3. Claude Desktop 설정

1. Claude Desktop 설정 파일을 엽니다:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. 다음 내용을 추가합니다:

```json
{
  "mcpServers": {
    "ainote": {
      "command": "ainote-mcp",
      "env": {
        "AINOTE_API_KEY": "여기에_발급받은_MCP_키를_입력하세요",
        "AINOTE_API_URL": "https://api.ainote.dev"
      }
    }
  }
}
```

수동 설치한 경우:
```json
{
  "mcpServers": {
    "ainote": {
      "command": "node",
      "args": ["/설치경로/ainote-mcp/index.js"],
      "env": {
        "AINOTE_API_KEY": "여기에_발급받은_MCP_키를_입력하세요",
        "AINOTE_API_URL": "https://api.ainote.dev"
      }
    }
  }
}
```

3. Claude Desktop을 재시작합니다

## 4. 사용 방법

Claude Desktop에서 다음과 같은 명령어를 사용할 수 있습니다:

### 할 일 목록 보기
- "내 할 일 목록을 보여줘"
- "중요한 할 일만 보여줘"
- "완료된 할 일을 보여줘"

### 할 일 추가
- "새 할 일 추가: [내용]"
- "중요한 할 일 추가: [내용]"
- "[카테고리]에 할 일 추가: [내용]"

### 할 일 수정
- "[할 일 ID]를 [새로운 내용]으로 변경해줘"
- "[할 일 ID]를 중요 표시해줘"
- "[할 일 ID]를 완료 처리해줘"

### 할 일 삭제
- "[할 일 ID]를 삭제해줘"

### 카테고리 보기
- "내 카테고리 목록을 보여줘"

## 5. 문제 해결

### MCP 서버가 연결되지 않는 경우
1. API 키가 올바른지 확인합니다
2. 인터넷 연결을 확인합니다
3. Claude Desktop을 완전히 종료하고 다시 시작합니다

### 권한 오류가 발생하는 경우
```bash
chmod +x $(which ainote-mcp)
```

### 로그 확인
- macOS/Linux: `tail -f ~/.claude/logs/mcp.log`
- Windows: `%USERPROFILE%\.claude\logs\mcp.log`

## 6. 보안 주의사항

- MCP 키는 절대 다른 사람과 공유하지 마세요
- 키가 노출된 경우 즉시 웹 설정에서 삭제하고 새로 발급받으세요
- 설정 파일을 Git 등에 커밋하지 마세요

## 7. 지원

문제가 있거나 도움이 필요한 경우:
- 이슈 리포트: https://github.com/ainote-dev/ainote-mcp/issues
- 이메일: support@ainote.app