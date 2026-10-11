/**
 * Accept 헤더 회귀 가드
 *
 * 공식 mcp gem 의 modern lifecycle(2026-07-28) 경로는 Accept 에
 * text/event-stream 이 없는 요청을 JSON-RPC 파싱 이전에 406 으로 거부한다.
 * 에러코드보다 먼저 걸리는 관문이라, 빠지면 bump 시 원인 파악이 어렵다.
 * upstream main(b98b783a5) 실측에서 spike 스펙의 modern 경로 2건이 이 406 으로 실패했다.
 *
 * 두 층으로 본다.
 *   - 런타임: 실제 나간 요청의 헤더를 단언한다. 강한 증거이지만 구동 가능한
 *     진입점에만 쓸 수 있다(CLI 진입점은 process.exit·프롬프트를 탄다).
 *   - AST: 구동할 수 없는 호출부까지 소스에서 훑는다. 새 호출 지점이 Accept
 *     없이 추가되는 것을 잡는 그물.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

const MODERN_ACCEPT = 'application/json, text/event-stream';
const LIB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');
const HTTP_METHODS = new Set(['post', 'get', 'put', 'patch', 'delete', 'request']);

/**
 * axios 인스턴스로 나가는 호출은 per-call headers 없이 인스턴스 defaults 를
 * 상속하므로 AST 로는 판정할 수 없다. 대신 각 항목을 런타임 테스트가 담당한다.
 * 새 항목이 늘면 이 목록이 어긋나 테스트가 실패한다 — 런타임 검증 없이
 * 인스턴스 호출을 추가하는 것을 막는 장치다.
 */
const INSTANCE_CALL_SITES = ['utils/api-client.js'];

function jsFilesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return jsFilesUnder(full);
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });
}

/**
 * 정확히 '/api/mcp' 로 끝나는 URL 인지 검사한다. '/api/mcp/tasks',
 * '/api/mcp-keys' 같은 하위·형제 경로는 JSON-RPC 엔드포인트가 아니라 제외된다.
 */
function endsWithApiMcp(node) {
  if (!node) return false;
  if (node.type === 'StringLiteral') return node.value.endsWith('/api/mcp');
  if (node.type === 'TemplateLiteral') {
    const last = node.quasis[node.quasis.length - 1];
    return !!last && last.value.cooked.endsWith('/api/mcp');
  }
  return false;
}

/**
 * 같은 이름의 프로퍼티가 여러 번 나오면 **뒤가 이긴다**. 첫 매치만 보면
 * 나중 값이 실제 헤더를 덮어써도 통과하므로 마지막 매치를 돌려준다.
 */
function objectProperty(objectExpression, name) {
  const matches = objectExpression.properties.filter(
    (p) =>
      p.type === 'ObjectProperty' &&
      !p.computed &&
      ((p.key.type === 'Identifier' && p.key.name === name) ||
        (p.key.type === 'StringLiteral' && p.key.value === name))
  );
  return matches[matches.length - 1];
}

/** spread 는 무엇이 들어올지 정적으로 알 수 없다 — 판정 불가로 본다. */
function hasSpread(objectExpression) {
  return objectExpression.properties.some((p) => p.type === 'SpreadElement');
}

function declaresModernAccept(objectExpression) {
  if (!objectExpression || objectExpression.type !== 'ObjectExpression') return false;
  if (hasSpread(objectExpression)) return false;

  const headersProp = objectProperty(objectExpression, 'headers');
  if (!headersProp || headersProp.value.type !== 'ObjectExpression') return false;
  if (hasSpread(headersProp.value)) return false;

  const acceptProp = objectProperty(headersProp.value, 'Accept');
  return (
    !!acceptProp && acceptProp.value.type === 'StringLiteral' && acceptProp.value.value === MODERN_ACCEPT
  );
}

/**
 * '/api/mcp' 로 나가는 호출을 AST 에서 모은다. 두 형태를 함께 본다.
 *   - `<obj>.post(url, data, config)` 등 메서드 형태
 *   - `axios(config)` / `<obj>.request(config)` 처럼 config 객체에 url 이 담긴 형태
 * 각 호출을 `bare`(axios 직접 — per-call 헤더 필수)와 `instance`(defaults 상속)로 나눈다.
 */
function findApiMcpCalls(ast) {
  const calls = [];

  function classify(node, configNode) {
    const callee = node.callee;
    const viaBareAxios =
      (callee.type === 'Identifier' && callee.name === 'axios') ||
      (callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'axios');
    calls.push({ node, configNode, viaBareAxios });
  }

  function walk(node) {
    if (!node || typeof node.type !== 'string') return;

    if (node.type === 'CallExpression') {
      const isHttpMethod =
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.property.type === 'Identifier' &&
        HTTP_METHODS.has(node.callee.property.name);

      if (isHttpMethod && endsWithApiMcp(node.arguments[0])) {
        // .post(url, data, config) — config 는 마지막 인자
        classify(node, node.arguments[node.arguments.length - 1]);
      } else {
        // axios(config) / .request(config) — url 이 config 객체 안에 있다
        const configArg = node.arguments.find(
          (a) => a && a.type === 'ObjectExpression' && endsWithApiMcp(objectProperty(a, 'url')?.value)
        );
        if (configArg) classify(node, configArg);
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key.endsWith('Comments')) continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value.type === 'string') walk(value);
    }
  }

  walk(ast.program);
  return calls;
}

function collectCallSites() {
  const bare = [];
  const instance = [];

  for (const file of jsFilesUnder(LIB_DIR)) {
    const ast = parse(readFileSync(file, 'utf8'), { sourceType: 'module' });
    for (const call of findApiMcpCalls(ast)) {
      const entry = { file: relative(LIB_DIR, file), ok: declaresModernAccept(call.configNode) };
      (call.viaBareAxios ? bare : instance).push(entry);
    }
  }

  return { bare, instance };
}

describe('Accept 헤더 (modern lifecycle 406 가드)', () => {
  it('createApiClient 가 만든 인스턴스의 callTool 이 실제로 modern Accept 를 보낸다', async () => {
    const { createApiClient } = await import('../lib/utils/api-client.js');
    const client = createApiClient({ type: 'mcpKey', apiKey: 'test_key_accept_header' });

    // 인스턴스에만 어댑터를 걸어 전역 axios 와 다른 스위트를 건드리지 않는다.
    const mock = new MockAdapter(client);
    let sent;
    mock.onPost(/\/api\/mcp$/).reply((config) => {
      sent = config.headers;
      return [200, { result: { content: [] } }];
    });

    try {
      await client.callTool('list_tasks', {});
      // defaults 가 아니라 실제 전송 헤더를 본다 — per-call override 결함까지 잡는다.
      expect(sent.Accept).toBe(MODERN_ACCEPT);
    } finally {
      mock.restore();
    }
  });

  it('get_setup_guide 핸들러가 실제로 나간 요청의 Accept 를 modern 값으로 보낸다', async () => {
    const mockAxios = new MockAdapter(axios);
    let capturedHeaders;

    mockAxios.onPost(/\/api\/mcp$/).reply((config) => {
      capturedHeaders = config.headers;
      return [200, { data: { result: { content: [{ type: 'text', text: 'setup guide' }] } } }];
    });

    try {
      const { getOnboardingTools } = await import('../lib/tools/onboarding-tools.js');
      const setupGuideTool = getOnboardingTools().find((tool) => tool.definition.name === 'get_setup_guide');

      const result = await setupGuideTool.handler();

      expect(capturedHeaders.Accept).toBe(MODERN_ACCEPT);
      expect(result.content[0].text).toBe('setup guide');
    } finally {
      mockAxios.restore();
    }
  });

  it('axios 를 직접 쓰는 /api/mcp 호출은 모두 Accept 를 modern 값으로 선언한다', () => {
    const { bare } = collectCallSites();

    // 호출 지점이 사라지면(경로 변경 등) 가드가 조용히 무력해지므로 0건이면 실패시킨다.
    expect(bare.length).toBeGreaterThan(0);
    expect(bare.filter((c) => !c.ok).map((c) => c.file)).toEqual([]);
  });

  it('axios 인스턴스로 나가는 /api/mcp 호출은 런타임 검증 대상 목록과 일치한다', () => {
    const { instance } = collectCallSites();

    // 인스턴스 호출은 defaults 를 상속해 AST 로 판정할 수 없다. 목록이 어긋나면
    // 런타임 테스트 없이 새 호출부가 들어왔다는 뜻이라 실패시킨다.
    expect([...new Set(instance.map((c) => c.file))].sort()).toEqual([...INSTANCE_CALL_SITES].sort());
  });
});
