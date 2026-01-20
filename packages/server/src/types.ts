export interface WSMessage {
  type: MessageType;
  payload: unknown;
  sessionId: string;
  timestamp: string;
}

export type MessageType =
  | 'bridge_connect'
  | 'bridge_disconnect'
  | 'file_content'
  | 'file_change'
  | 'new_prompt'
  | 'write_request'
  | 'write_response'
  | 'clear_request'
  | 'clear_response'
  | 'read_request'
  | 'read_response'
  | 'ping'
  | 'pong';

export interface FileContentPayload {
  content: string;
  filePath: string;
}

export interface NewPromptPayload {
  prompt: string;
  filePath: string;
}

export interface WriteRequestPayload {
  message: string;
}

export interface WriteResponsePayload {
  success: boolean;
  error?: string;
}

export interface ReadResponsePayload {
  content: string;
  pendingPrompts: string[];
}

import type { WebSocket as WSWebSocket } from 'ws';

export interface BridgeSession {
  id: string;
  ws: WSWebSocket;
  filePath: string | null;
  connected: boolean;
  lastSeen: Date;
  pendingPrompts: string[];
}

export interface WatchResult {
  status: 'received' | 'stopped' | 'waiting' | 'no_bridge' | 'error';
  human_input?: string;
  message?: string;
  file_path?: string;
  timestamp?: string;
}
