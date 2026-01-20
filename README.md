# MCP Notepad Watcher

A Model Context Protocol (MCP) system that allows AI agents to receive human input through a local notepad file, with the server hosted remotely on Railway.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      YOUR LOCAL MACHINE                          │
│  ┌──────────────────┐    ┌─────────────────────────────────┐   │
│  │ cursor-notepad.txt│◄──►│    mcp-notepad-bridge          │   │
│  │ (Desktop file)    │    │    (auto-started by Cursor)    │   │
│  └──────────────────┘    └──────────────┬──────────────────┘   │
└─────────────────────────────────────────┼──────────────────────┘
                                          │ WebSocket
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         RAILWAY                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              mcp-notepad-server                          │   │
│  │  - WebSocket hub for bridge connections                  │   │
│  │  - MCP tool logic                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Deploy Server to Railway

```bash
cd packages/server
npm install
npm run build
# Deploy to Railway via GitHub or Railway CLI
```

### 2. Configure Cursor MCP

Add to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "notepad": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-notepad-bridge",
        "--server", "wss://your-app.railway.app/bridge",
        "--file", "C:/Users/YOUR_USERNAME/Desktop/cursor-notepad.txt"
      ]
    }
  }
}
```

### 3. Use It

1. Open Cursor
2. Edit your Desktop `cursor-notepad.txt` file
3. Write your prompt and press Enter twice (blank line)
4. The AI agent receives your input!

## Packages

### mcp-notepad-server

The Railway-hosted server that:
- Accepts WebSocket connections from bridges
- Routes MCP tool calls to connected bridges
- Provides health checks and monitoring

### mcp-notepad-bridge

The local bridge that:
- Watches your local notepad file for changes
- Connects to the Railway server via WebSocket
- Exposes MCP tools to Cursor via STDIO

## MCP Tools

| Tool | Description |
|------|-------------|
| `watch_notepad` | Wait for human input from the notepad file |
| `write_to_notepad` | Write a message to the notepad file |
| `clear_notepad` | Clear the notepad file |
| `read_notepad` | Read current contents of the notepad |

## Development

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run server locally
npm run dev:server

# Run bridge locally
npm run dev:bridge -- --server ws://localhost:3000/bridge --file ~/test-notepad.txt
```

## License

MIT
