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

export interface BridgeConnectPayload {
  sessionId: string;
}
