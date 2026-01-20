import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { WatchResult } from './types.js';
import { getActiveSession, waitForPrompt, sendWriteRequest, sendClearRequest, sendReadRequest } from './websocket.js';

export const tools: Tool[] = [
  {
    name: 'watch_notepad',
    description: `Watches a notepad file for human input via the bridge connection.
Use this tool to wait for human instructions written in the local notepad file.
The user writes in the notepad file, and when they press Enter twice, their text becomes a new prompt.
If the user types "STOP", the watching ends.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        timeout_seconds: {
          type: 'number',
          description: 'Maximum seconds to wait for input. 0 means wait indefinitely. Default is 300.',
        },
        message_to_user: {
          type: 'string',
          description: 'Optional message to display to the user about what input you are expecting',
        },
      },
      required: [],
    },
  },
  {
    name: 'write_to_notepad',
    description: 'Writes a message to the notepad file via the bridge connection',
    inputSchema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'Message to write to the notepad',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'clear_notepad',
    description: 'Clears the notepad file via the bridge connection',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'read_notepad',
    description: 'Reads the current contents of the notepad via the bridge connection',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<WatchResult> {
  const session = getActiveSession();

  if (!session) {
    return {
      status: 'no_bridge',
      message: 'No bridge client connected. Please ensure the bridge is running.',
    };
  }

  switch (name) {
    case 'watch_notepad': {
      const timeoutSeconds = (args.timeout_seconds as number) || 300;
      const messageToUser = args.message_to_user as string | undefined;

      if (messageToUser) {
        sendWriteRequest(session, `\n[AGENT WAITING FOR INPUT]\n${messageToUser}\n[Write your response below, then press Enter twice]\n`);
      }

      const prompt = await waitForPrompt(session, timeoutSeconds * 1000);

      if (prompt === null) {
        return {
          status: 'waiting',
          message: `No input received within ${timeoutSeconds} seconds. Call watch_notepad again to continue waiting.`,
        };
      }

      if (prompt === '__STOP__') {
        return {
          status: 'stopped',
          message: 'User requested to stop the session',
        };
      }

      return {
        status: 'received',
        human_input: prompt,
        file_path: session.filePath || undefined,
        timestamp: new Date().toISOString(),
      };
    }

    case 'write_to_notepad': {
      const message = args.message as string;
      if (!message) {
        return { status: 'error', message: 'Message is required' };
      }
      sendWriteRequest(session, message);
      return { status: 'received', message: 'Message sent to bridge' };
    }

    case 'clear_notepad': {
      sendClearRequest(session);
      return { status: 'received', message: 'Clear request sent to bridge' };
    }

    case 'read_notepad': {
      sendReadRequest(session);
      return {
        status: 'received',
        message: 'Read request sent to bridge. Content will be available on next watch.',
      };
    }

    default:
      return { status: 'error', message: `Unknown tool: ${name}` };
  }
}
