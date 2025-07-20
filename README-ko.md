# AI Note MCP 서버

[![npm version](https://badge.fury.io/js/%40ainote%2Fmcp-server.svg)](https://badge.fury.io/js/%40ainote%2Fmcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Claude Desktop을 AI Note 작업 관리 시스템에 연결하는 MCP(Model Context Protocol) 서버입니다. 이 서버를 통해 Claude가 AI Note 작업을 직접 관리할 수 있으며, 자연어 대화를 통해 작업 생성, 수정, 관리가 가능합니다.

## 목차

- [기능](#기능)
- [사전 요구사항](#사전-요구사항)
- [설치](#설치)
- [설정](#설정)
- [사용법](#사용법)
- [사용 가능한 도구](#사용-가능한-도구)
- [API 참조](#api-참조)
- [개발](#개발)
- [문제 해결](#문제-해결)
- [기여하기](#기여하기)
- [라이선스](#라이선스)

## 기능

- 📝 **작업 관리**: Claude Desktop에서 직접 작업 생성, 수정, 삭제, 조회
- 🏷️ **카테고리 지원**: 카테고리를 통한 작업 구성
- 🔍 **고급 검색**: 내용, 상태 등을 기준으로 작업 검색
- ⭐ **우선순위 관리**: 중요한 작업 표시
- 📅 **마감일 지원**: 작업 마감일 설정 및 관리
- 🔒 **보안 API 연동**: API 키 인증을 통한 안전한 접근

## 사전 요구사항

- Node.js >= 16.0.0
- npm 또는 yarn
- AI Note API 접근 권한 (API 키 필요)
- MCP 지원이 활성화된 Claude Desktop

## 설치

### 방법 1: npm을 통한 설치

```bash
npm install -g @ainote/mcp-server
```

### 방법 2: 소스코드로부터 설치

```bash
git clone https://github.com/your-username/ainote-mcp-server.git
cd ainote-mcp-server
npm install
```

## 설정

### 1. 환경 변수 설정

`.env` 파일을 생성하거나 다음 환경 변수를 설정하세요:

```bash
# 필수
export AINOTE_API_KEY="여기에-api-키-입력"

# 선택사항 (기본값: 프로덕션 URL)
export AINOTE_API_URL="https://ainote-5muq.onrender.com"
```

### 2. Claude Desktop 설정

Claude Desktop 설정 파일에 다음 내용을 추가하세요:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ainote": {
      "command": "node",
      "args": ["/path/to/ainote-mcp-server/index.js"],
      "env": {
        "AINOTE_API_KEY": "여기에-api-키-입력"
      }
    }
  }
}
```

npm을 통해 전역으로 설치한 경우:

```json
{
  "mcpServers": {
    "ainote": {
      "command": "ainote-mcp",
      "env": {
        "AINOTE_API_KEY": "여기에-api-키-입력"
      }
    }
  }
}
```

### 3. Claude Desktop 재시작

설정 후 Claude Desktop을 재시작하여 MCP 서버를 로드하세요.

## 사용법

설정이 완료되면 Claude를 통해 AI Note 작업과 상호작용할 수 있습니다:

### 대화 예시

```
사용자: "내 대기 중인 작업들을 보여줘"
Claude: AI Note에서 대기 중인 작업들을 가져오겠습니다...

사용자: "금요일까지 분기 보고서 검토하는 새 작업을 만들어줘"
Claude: 금요일을 마감일로 하는 작업을 생성하겠습니다...

사용자: "작업 ID 123을 완료로 표시해줘"
Claude: 해당 작업을 완료로 표시하겠습니다...
```

## 사용 가능한 도구

### list_tasks

필터링 옵션과 함께 AI Note에서 작업 목록을 조회합니다.

**매개변수:**
- `status` (선택사항): 상태별 필터 - "pending" 또는 "completed"
- `limit` (선택사항): 반환할 최대 작업 수 (기본값: 25, 최대: 500)
- `search` (선택사항): 작업 내용 검색 키워드

### create_task

AI Note에 새 작업을 생성합니다.

**매개변수:**
- `content` (필수): 작업 설명
- `is_important` (선택사항): 중요 표시 (boolean)
- `due_date` (선택사항): ISO 형식의 마감일
- `category_id` (선택사항): 할당할 카테고리 ID

### update_task

기존 작업을 수정합니다.

**매개변수:**
- `id` (필수): 작업 ID
- `content` (선택사항): 새로운 작업 내용
- `is_important` (선택사항): 중요 상태 업데이트
- `completed_at` (선택사항): 완료로 표시 (ISO 형식) 또는 null로 미완료 처리

### delete_task

작업을 소프트 삭제합니다.

**매개변수:**
- `id` (필수): 삭제할 작업 ID

### list_categories

사용 가능한 모든 카테고리를 조회합니다.

**매개변수:** 없음

## API 참조

MCP 서버는 다음 엔드포인트를 통해 AI Note API와 통신합니다:

- `GET /api/mcp/tasks` - 작업 목록 조회
- `POST /api/mcp/tasks` - 작업 생성
- `PUT /api/mcp/tasks/:id` - 작업 수정
- `DELETE /api/mcp/tasks/:id` - 작업 삭제
- `GET /api/mcp/categories` - 카테고리 목록 조회

모든 요청은 `Authorization` 헤더를 통한 API 키 인증이 필요합니다.

## 개발

### 로컬에서 실행하기

```bash
# 저장소 클론
git clone https://github.com/your-username/ainote-mcp-server.git
cd ainote-mcp-server

# 의존성 설치
npm install

# 서버 실행
npm start
```

### Claude Desktop으로 테스트

1. Claude Desktop 설정을 로컬 개발 서버를 가리키도록 업데이트
2. 테스트를 위한 환경 변수 설정
3. Claude Desktop 재시작
4. Claude Desktop 설정에서 MCP 연결 상태 확인

### 프로젝트 구조

```
ainote-mcp-server/
├── index.js          # 메인 서버 구현
├── package.json      # 패키지 설정
├── README.md         # 영문 문서
├── README-ko.md      # 한글 문서
└── LICENSE           # MIT 라이선스
```

## 문제 해결

### 일반적인 문제

1. **"API 키를 찾을 수 없음" 오류**
   - 환경 변수나 Claude 설정에 `AINOTE_API_KEY`가 설정되어 있는지 확인
   - API 키가 유효하고 적절한 권한이 있는지 확인

2. **"연결 거부됨" 오류**
   - API URL이 올바른지 확인
   - 네트워크 연결 확인
   - AI Note API 서버가 실행 중인지 확인

3. **"도구를 찾을 수 없음" 오류**
   - 설정 변경 후 Claude Desktop 재시작
   - Claude Desktop에서 MCP 서버가 올바르게 설정되었는지 확인

4. **작업이 표시되지 않음**
   - API 키 권한 확인
   - 올바른 상태(pending/completed)를 조회하고 있는지 확인
   - 검색 매개변수 사용 시도

### 디버그 모드

디버그 로깅을 활성화하려면:

```bash
export DEBUG=mcp:*
```

## 기여하기

기여를 환영합니다! 다음 단계를 따라주세요:

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 열기

### 개발 가이드라인

- 기존 코드 스타일 따르기
- 새 기능에 대한 테스트 추가
- 필요시 문서 업데이트
- PR 제출 전 모든 테스트 통과 확인

## 라이선스

이 프로젝트는 MIT 라이선스 하에 제공됩니다 - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 지원

- 📧 이메일: support@ainote.dev
- 🐛 이슈: [GitHub Issues](https://github.com/your-username/ainote-mcp-server/issues)
- 💬 Discord: [커뮤니티 참여](https://discord.gg/ainote)

## 감사의 말

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)로 제작
- [AI Note](https://ainote.dev)에서 제공
- [Claude Desktop](https://claude.ai/desktop)을 위해 제작