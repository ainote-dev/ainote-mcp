#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createChatGptServer } from './lib/core/server-factory.js';
import { getConfig } from './lib/core/config-manager.js';
import { resolveAuthContext } from './lib/auth/strategy-factory.js';

const config = getConfig();

if (!config.features.sseTransport) {
  console.error('[ainote-mcp] SSE transport is disabled. Set AINOTE_ENABLE_SSE_TRANSPORT=true to enable.');
  process.exit(1);
}

const app = express();
const sessions = new Map();

const corsOptions = {
  origin: config.http.allowedOrigins.length > 0 ? config.http.allowedOrigins : true,
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '4mb' }));
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    transport: 'sse',
    timestamp: Date.now()
  });
});

app.get(config.http.endpoint, async (req, res) => {
  try {
    const { server } = createChatGptServer();
    const transport = new SSEServerTransport(config.http.messageEndpoint, res, {
      enableDnsRebindingProtection: config.http.allowedHosts.length > 0 || config.http.allowedOrigins.length > 0,
      allowedHosts: config.http.allowedHosts.length > 0 ? config.http.allowedHosts : undefined,
      allowedOrigins: config.http.allowedOrigins.length > 0 ? config.http.allowedOrigins : undefined
    });

    sessions.set(transport.sessionId, { transport, server });

    transport.onclose = async () => {
      sessions.delete(transport.sessionId);
      try {
        await server.close();
      } catch (closeError) {
        console.error(`[ainote-mcp] Error while closing server: ${closeError.message}`);
      }
    };

    transport.onerror = (error) => {
      console.error(`[ainote-mcp] SSE transport error: ${error.message}`);
    };

    await server.connect(transport);
  } catch (error) {
    console.error(`[ainote-mcp] Failed to establish SSE connection: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish SSE connection' });
    }
  }
});

app.post(config.http.messageEndpoint, async (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId query parameter' });
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: `No transport found for sessionId ${sessionId}` });
  }

  const authContext = resolveAuthContext('sse', req.headers);
  req.auth = authContext;

  try {
    await session.transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error(`[ainote-mcp] Failed to handle POST message: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to handle message' });
    }
  }
});

const port = config.http.port;
app.listen(port, () => {
  console.error(`AI Note MCP HTTP/SSE server listening on port ${port}`);
});
