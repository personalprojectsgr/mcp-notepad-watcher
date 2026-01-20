import WebSocket from 'ws';
import { WSMessage, BridgeConnectPayload, WriteRequestPayload } from './types.js';
import { appendToFile, clearFile, readFileContent, parseNewPrompts, markAsProcessed } from './file-watcher.js';

let ws: WebSocket | null = null;
let sessionId: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let filePath: string = '';

export function connectToServer(serverUrl: string, notepadPath: string, onConnect: () => void): void {
  filePath = notepadPath;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  ws = new WebSocket(serverUrl);

  ws.on('open', () => {
    console.log('[Bridge] Connected to server');
    sendFileContent();
    onConnect();
  });

  ws.on('message', (data: Buffer) => {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      handleMessage(message);
    } catch {
      console.error('[Bridge] Failed to parse message');
    }
  });

  ws.on('close', () => {
    console.log('[Bridge] Disconnected from server, reconnecting in 5s...');
    sessionId = null;
    reconnectTimer = setTimeout(() => connectToServer(serverUrl, notepadPath, onConnect), 5000);
  });

  ws.on('error', (err) => {
    console.error('[Bridge] WebSocket error:', err.message);
  });
}

function handleMessage(message: WSMessage): void {
  switch (message.type) {
    case 'bridge_connect': {
      const payload = message.payload as BridgeConnectPayload;
      sessionId = payload.sessionId;
      console.log('[Bridge] Session established:', sessionId);
      break;
    }
    case 'write_request': {
      const payload = message.payload as WriteRequestPayload;
      appendToFile(filePath, payload.message);
      sendMessage({ type: 'write_response', payload: { success: true }, sessionId: sessionId || '', timestamp: new Date().toISOString() });
      break;
    }
    case 'clear_request': {
      clearFile(filePath);
      sendMessage({ type: 'clear_response', payload: { success: true }, sessionId: sessionId || '', timestamp: new Date().toISOString() });
      break;
    }
    case 'read_request': {
      const content = readFileContent(filePath);
      const pendingPrompts = parseNewPrompts(filePath);
      sendMessage({ type: 'read_response', payload: { content, pendingPrompts }, sessionId: sessionId || '', timestamp: new Date().toISOString() });
      break;
    }
    case 'ping': {
      sendMessage({ type: 'pong', payload: {}, sessionId: sessionId || '', timestamp: new Date().toISOString() });
      break;
    }
  }
}

function sendMessage(message: WSMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendFileContent(): void {
  const content = readFileContent(filePath);
  sendMessage({ type: 'file_content', payload: { content, filePath }, sessionId: sessionId || '', timestamp: new Date().toISOString() });
}

export function sendNewPrompt(prompt: string): void {
  markAsProcessed(filePath);
  sendMessage({ type: 'new_prompt', payload: { prompt, filePath }, sessionId: sessionId || '', timestamp: new Date().toISOString() });
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}
