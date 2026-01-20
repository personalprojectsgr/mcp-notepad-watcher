import { WebSocketServer, WebSocket as WSWebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { WSMessage, BridgeSession, NewPromptPayload, WriteResponsePayload, ReadResponsePayload } from './types.js';

const sessions = new Map<string, BridgeSession>();
const promptResolvers = new Map<string, (prompt: string | null) => void>();

export function createWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/bridge' });

  wss.on('connection', (ws: WSWebSocket) => {
    const sessionId = generateSessionId();
    const session: BridgeSession = {
      id: sessionId,
      ws,
      filePath: null,
      connected: true,
      lastSeen: new Date(),
      pendingPrompts: [],
    };
    sessions.set(sessionId, session);

    sendMessage(ws, { type: 'bridge_connect', payload: { sessionId }, sessionId, timestamp: new Date().toISOString() });

    ws.on('message', (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        session.lastSeen = new Date();
        handleMessage(session, message);
      } catch {
        console.error('[WS] Failed to parse message');
      }
    });

    ws.on('close', () => {
      session.connected = false;
      const resolver = promptResolvers.get(sessionId);
      if (resolver) {
        resolver(null);
        promptResolvers.delete(sessionId);
      }
      sessions.delete(sessionId);
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
    });
  });

  setInterval(() => {
    sessions.forEach((session) => {
      if (session.connected) {
        sendMessage(session.ws, { type: 'ping', payload: {}, sessionId: session.id, timestamp: new Date().toISOString() });
      }
    });
  }, 30000);

  return wss;
}

function handleMessage(session: BridgeSession, message: WSMessage): void {
  switch (message.type) {
    case 'file_content':
      session.filePath = (message.payload as { filePath: string }).filePath;
      break;
    case 'new_prompt': {
      const { prompt } = message.payload as NewPromptPayload;
      if (prompt.toUpperCase() === 'STOP') {
        const resolver = promptResolvers.get(session.id);
        if (resolver) {
          resolver('__STOP__');
          promptResolvers.delete(session.id);
        }
      } else {
        const resolver = promptResolvers.get(session.id);
        if (resolver) {
          resolver(prompt);
          promptResolvers.delete(session.id);
        } else {
          session.pendingPrompts.push(prompt);
        }
      }
      break;
    }
    case 'write_response': {
      const payload = message.payload as WriteResponsePayload;
      console.log('[WS] Write response:', payload.success ? 'success' : payload.error);
      break;
    }
    case 'read_response': {
      const payload = message.payload as ReadResponsePayload;
      session.pendingPrompts = payload.pendingPrompts;
      break;
    }
    case 'pong':
      break;
  }
}

function sendMessage(ws: WSWebSocket, message: WSMessage): void {
  if (ws.readyState === WSWebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getActiveSession(): BridgeSession | null {
  for (const session of sessions.values()) {
    if (session.connected) return session;
  }
  return null;
}

export function waitForPrompt(session: BridgeSession, timeoutMs: number): Promise<string | null> {
  if (session.pendingPrompts.length > 0) {
    return Promise.resolve(session.pendingPrompts.shift()!);
  }
  return new Promise((resolve) => {
    promptResolvers.set(session.id, resolve);
    if (timeoutMs > 0) {
      setTimeout(() => {
        if (promptResolvers.has(session.id)) {
          promptResolvers.delete(session.id);
          resolve(null);
        }
      }, timeoutMs);
    }
  });
}

export function sendWriteRequest(session: BridgeSession, message: string): void {
  sendMessage(session.ws, {
    type: 'write_request',
    payload: { message },
    sessionId: session.id,
    timestamp: new Date().toISOString(),
  });
}

export function sendClearRequest(session: BridgeSession): void {
  sendMessage(session.ws, {
    type: 'clear_request',
    payload: {},
    sessionId: session.id,
    timestamp: new Date().toISOString(),
  });
}

export function sendReadRequest(session: BridgeSession): void {
  sendMessage(session.ws, {
    type: 'read_request',
    payload: {},
    sessionId: session.id,
    timestamp: new Date().toISOString(),
  });
}
