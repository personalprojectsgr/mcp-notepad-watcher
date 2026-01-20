#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import { ensureFileExists, initializeWatchState, watchFile, parseNewPrompts } from './file-watcher.js';
import { connectToServer, sendNewPrompt, isConnected } from './websocket-client.js';

const args = process.argv.slice(2);
let serverUrl = '';
let filePath = path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Desktop', 'cursor-notepad.txt');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--server' && args[i + 1]) serverUrl = args[++i];
  else if (args[i] === '--file' && args[i + 1]) filePath = args[++i];
}

if (!serverUrl) {
  console.error('Usage: mcp-notepad-bridge --server <wss://...> [--file <path>]');
  process.exit(1);
}

const tools: Tool[] = [
  {
    name: 'watch_notepad',
    description: 'Watches a notepad file for human input. Blocks until the user writes a new prompt.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        timeout_seconds: { type: 'number', description: 'Maximum seconds to wait. Default 300.' },
        message_to_user: { type: 'string', description: 'Optional message to display.' },
      },
      required: [],
    },
  },
  {
    name: 'write_to_notepad',
    description: 'Writes a message to the notepad file',
    inputSchema: { type: 'object' as const, properties: { message: { type: 'string' } }, required: ['message'] },
  },
  {
    name: 'clear_notepad',
    description: 'Clears the notepad file',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'read_notepad',
    description: 'Reads the current contents of the notepad',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
];

const server = new Server({ name: 'mcp-notepad-bridge', version: '2.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  return { content: [{ type: 'text', text: JSON.stringify({ status: 'proxied', tool: name, note: 'Handled via server' }) }] };
});

async function main(): Promise<void> {
  ensureFileExists(filePath);
  initializeWatchState(filePath);

  connectToServer(serverUrl, filePath, () => {
    console.error(`[Bridge] Watching file: ${filePath}`);
  });

  watchFile(filePath, (prompts) => {
    if (isConnected()) {
      prompts.forEach((prompt) => sendNewPrompt(prompt));
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Bridge] MCP Bridge started');
}

main().catch((err) => {
  console.error('[Bridge] Fatal error:', err);
  process.exit(1);
});
