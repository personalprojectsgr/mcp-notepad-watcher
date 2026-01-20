import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { createWebSocketServer, getActiveSession } from './websocket.js';
import { tools, handleToolCall } from './mcp-tools.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    name: 'mcp-notepad-server',
    version: '2.0.0',
    description: 'MCP Notepad Server - Railway hosted',
    status: 'running',
    bridge_connected: getActiveSession() !== null,
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/tools', (_req, res) => {
  res.json({ tools });
});

app.post('/tool/:name', async (req, res) => {
  const { name } = req.params;
  const args = req.body || {};
  try {
    const result = await handleToolCall(name, args);
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', message: (err as Error).message });
  }
});

const server = createServer(app);
createWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`[Server] MCP Notepad Server running on port ${PORT}`);
  console.log(`[Server] WebSocket bridge endpoint: ws://localhost:${PORT}/bridge`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
});
