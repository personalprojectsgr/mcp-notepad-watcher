# MCP Notepad Watcher

A Model Context Protocol (MCP) server that allows AI agents to receive human input through a local notepad file.

## Features

- **watch_notepad** - Wait for human input from a notepad file
- **write_to_notepad** - Write messages to the notepad file
- **clear_notepad** - Clear the notepad file
- **read_notepad** - Read current contents without waiting

## Installation

```bash
npm install
npm run build
```

## Usage

### Configure Cursor MCP

Add to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "notepad": {
      "command": "node",
      "args": ["C:/path/to/mcp-notepad-watcher/dist/index.js"],
      "env": {
        "NOTEPAD_PATH": "C:/Users/YOUR_USERNAME/Desktop/cursor-notepad.txt"
      }
    }
  }
}
```

### Default File Location

If `NOTEPAD_PATH` is not set, the notepad file defaults to:
- Windows: `%USERPROFILE%/cursor-notepad.txt`
- Mac/Linux: `~/cursor-notepad.txt`

### How It Works

1. The AI agent calls `watch_notepad` to wait for your input
2. You write your prompt in the notepad file
3. Press Enter twice (create a blank line) to submit
4. The AI receives your input and continues
5. Type "STOP" to end the session

## Example Session

In the notepad file:
```
# Cursor Agent Notepad
# Write your prompts below, separated by double-enter (blank line)

[AGENT WAITING FOR INPUT]
[Write your response below, then press Enter twice]

I want you to create a hello world function

<<<PROCESSED>>>
```

## Development

```bash
npm run dev  # Watch mode
npm run build  # Build
npm start  # Run
```

## License

MIT
