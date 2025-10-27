#!/usr/bin/env node
/**
 * JSON-RPC 2.0 통합 테스트 스크립트
 */

import { createApiClient } from './lib/utils/api-client.js';

async function testJsonRpc() {
  console.log('🧪 JSON-RPC 2.0 통합 테스트 시작...\n');

  try {
    // API 클라이언트 생성
    const authContext = {
      type: 'mcpKey',
      apiKey: process.env.AINOTE_API_KEY
    };

    const apiClient = createApiClient(authContext);

    // 테스트 1: list_tasks
    console.log('1️⃣ list_tasks 테스트');
    const tasksResult = await apiClient.callTool('list_tasks', {
      status: 'pending',
      limit: 5
    });
    console.log('✅ 성공:', JSON.stringify(tasksResult, null, 2));
    console.log('');

    // 테스트 2: list_categories
    console.log('2️⃣ list_categories 테스트');
    const categoriesResult = await apiClient.callTool('list_categories', {});
    console.log('✅ 성공:', JSON.stringify(categoriesResult, null, 2));
    console.log('');

    console.log('🎉 모든 테스트 통과!');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('서버 응답:', error.response.data);
    }
    process.exit(1);
  }
}

testJsonRpc();
