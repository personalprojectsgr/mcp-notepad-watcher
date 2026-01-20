#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

const PROCESSED_MARKER = "<<<PROCESSED>>>";
const DEFAULT_NOTEPAD_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME || ".",
  "cursor-notepad.txt"
);

const NOTEPAD_PATH = process.env.NOTEPAD_PATH || DEFAULT_NOTEPAD_PATH;

interface WatchState {
  lastProcessedIndex: number;
}

const watchStates: Map<string, WatchState> = new Map();

function ensureNotepadExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    const header = `# Cursor Agent Notepad
# Write your prompts below, separated by double-enter (blank line)
# The agent will pick up each new prompt automatically
# Type "STOP" to end the session
# ============================================

`;
    fs.writeFileSync(filePath, header, "utf-8");
  }
}

function getOrCreateWatchState(filePath: string): WatchState {
  if (!watchStates.has(filePath)) {
    const content = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf-8")
      : "";
    const markerIndex = content.lastIndexOf(PROCESSED_MARKER);
    watchStates.set(filePath, {
      lastProcessedIndex: markerIndex >= 0 ? markerIndex + PROCESSED_MARKER.length : content.length,
    });
  }
  return watchStates.get(filePath)!;
}

function isAgentMessage(text: string): boolean {
  const agentPatterns = [
    /^\[AGENT/i,
    /^<<<PROCESSED>>>/,
    /^\[Write your response/i,
    /^# /,
    /^={3,}/,
  ];
  return agentPatterns.some(pattern => pattern.test(text.trim()));
}

function parseNewPrompts(filePath: string, startIndex: number): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const newContent = content.slice(startIndex);
  
  const segments = newContent.split(/\n\n+/);
  
  const prompts = segments
    .map((s) => s.trim())
    .filter((s) => {
      if (s.length === 0) return false;
      if (s === PROCESSED_MARKER) return false;
      if (isAgentMessage(s)) return false;
      return true;
    });

  return prompts;
}

function updateStateIndex(filePath: string): void {
  const state = getOrCreateWatchState(filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  state.lastProcessedIndex = content.length;
}

function markAsProcessed(filePath: string): void {
  fs.appendFileSync(filePath, `\n${PROCESSED_MARKER}\n`);
  updateStateIndex(filePath);
}

function clearNotepad(filePath: string): void {
  const header = `# Cursor Agent Notepad - Cleared at ${new Date().toISOString()}
# Write your prompts below, separated by double-enter (blank line)
# The agent will pick up each new prompt automatically
# Type "STOP" to end the session
# ============================================

`;
  fs.writeFileSync(filePath, header, "utf-8");
  watchStates.delete(filePath);
}

const tools: Tool[] = [
  {
    name: "watch_notepad",
    description: `Watches a notepad file for human input. Blocks until the user writes a new prompt (separated by double-enter/blank line). 
    
Use this tool when you want to:
- Allow the human to guide the conversation mid-task
- Wait for human decisions or additional context
- Create an interactive loop where the human can continuously provide instructions

The user writes in the notepad file, and when they press Enter twice (creating a blank line), their text becomes a new prompt.
If the user types "STOP", the watching ends.

Returns the new prompt text that the human wrote.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: `Path to the notepad file to watch. Defaults to ${NOTEPAD_PATH}`,
        },
        timeout_seconds: {
          type: "number",
          description:
            "Maximum seconds to wait for input. 0 means wait indefinitely. Default is 0.",
        },
        message_to_user: {
          type: "string",
          description:
            "Optional message to display to the user about what input you're expecting",
        },
      },
      required: [],
    },
  },
  {
    name: "write_to_notepad",
    description:
      "Writes a message to the notepad file (useful for agent-to-human communication)",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the notepad file",
        },
        message: {
          type: "string",
          description: "Message to write to the notepad",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "clear_notepad",
    description: "Clears the notepad file and resets the watch state",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the notepad file to clear",
        },
      },
      required: [],
    },
  },
  {
    name: "read_notepad",
    description: "Reads the current contents of the notepad without waiting",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the notepad file",
        },
      },
      required: [],
    },
  },
];

const server = new Server(
  {
    name: "mcp-notepad-watcher",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "watch_notepad": {
        const filePath = (args?.file_path as string) || NOTEPAD_PATH;
        const timeoutSeconds = (args?.timeout_seconds as number) || 300;
        const messageToUser = args?.message_to_user as string;

        ensureNotepadExists(filePath);

        const state = getOrCreateWatchState(filePath);
        const existingPrompts = parseNewPrompts(filePath, state.lastProcessedIndex);
        
        if (existingPrompts.length > 0) {
          const prompt = existingPrompts[0];
          const isStop = prompt.toUpperCase() === "STOP";
          markAsProcessed(filePath);
          
          if (isStop) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    status: "stopped",
                    message: "User requested to stop the session",
                    file_path: filePath,
                  }),
                },
              ],
            };
          }
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "received",
                  human_input: prompt,
                  file_path: filePath,
                  timestamp: new Date().toISOString(),
                  instruction: "Process this human input as a new prompt continuing the conversation",
                }),
              },
            ],
          };
        }

        const waitMessage = messageToUser
          ? `\n[AGENT WAITING FOR INPUT]\n${messageToUser}\n[Write your response below, then press Enter twice]\n`
          : `\n[AGENT WAITING FOR INPUT]\n[Write your response below, then press Enter twice]\n`;

        fs.appendFileSync(filePath, waitMessage);
        
        const currentLength = fs.readFileSync(filePath, "utf-8").length;

        console.error(
          `[mcp-notepad-watcher] Waiting for input in: ${filePath} (watching from index ${currentLength})`
        );

        const startTime = Date.now();
        const timeoutMs = timeoutSeconds * 1000;
        const pollInterval = 500;
        
        while (true) {
          const prompts = parseNewPrompts(filePath, currentLength);

          if (prompts.length > 0) {
            const prompt = prompts[0];
            const isStop = prompt.toUpperCase() === "STOP";
            
            markAsProcessed(filePath);
            
            if (isStop) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      status: "stopped",
                      message: "User requested to stop the session",
                      file_path: filePath,
                    }),
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    status: "received",
                    human_input: prompt,
                    file_path: filePath,
                    timestamp: new Date().toISOString(),
                    instruction: "Process this human input as a new prompt continuing the conversation",
                  }),
                },
              ],
            };
          }

          if (timeoutMs > 0 && Date.now() - startTime >= timeoutMs) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    status: "waiting",
                    message: `No input received within ${timeoutSeconds} seconds. Call watch_notepad again to continue waiting.`,
                    file_path: filePath,
                    elapsed_seconds: Math.floor((Date.now() - startTime) / 1000),
                    instruction: "IMPORTANT: Call watch_notepad again immediately to continue the loop. The user may still be typing.",
                  }),
                },
              ],
            };
          }

          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }

      case "write_to_notepad": {
        const filePath = (args?.file_path as string) || NOTEPAD_PATH;
        const message = args?.message as string;

        if (!message) {
          throw new Error("Message is required");
        }

        ensureNotepadExists(filePath);

        const formattedMessage = `\n[AGENT MESSAGE - ${new Date().toISOString()}]\n${message}\n`;
        fs.appendFileSync(filePath, formattedMessage);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "written",
                file_path: filePath,
              }),
            },
          ],
        };
      }

      case "clear_notepad": {
        const filePath = (args?.file_path as string) || NOTEPAD_PATH;
        clearNotepad(filePath);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "cleared",
                file_path: filePath,
              }),
            },
          ],
        };
      }

      case "read_notepad": {
        const filePath = (args?.file_path as string) || NOTEPAD_PATH;

        if (!fs.existsSync(filePath)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "not_found",
                  file_path: filePath,
                }),
              },
            ],
          };
        }

        const content = fs.readFileSync(filePath, "utf-8");
        const state = getOrCreateWatchState(filePath);
        const pendingPrompts = parseNewPrompts(filePath, state.lastProcessedIndex);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "read",
                content: content,
                pending_prompts: pendingPrompts,
                file_path: filePath,
              }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            error: errorMessage,
          }),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  console.error(`[mcp-notepad-watcher] Starting with notepad path: ${NOTEPAD_PATH}`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-notepad-watcher] Server started");
}

main().catch((error) => {
  console.error("[mcp-notepad-watcher] Fatal error:", error);
  process.exit(1);
});
