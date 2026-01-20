import * as fs from 'fs';
import * as path from 'path';
import { watch, FSWatcher } from 'chokidar';

const PROCESSED_MARKER = '<<<PROCESSED>>>';
const HEADER = `# Cursor Agent Notepad
# Write your prompts below, separated by double-enter (blank line)
# The agent will pick up each new prompt automatically
# Type "STOP" to end the session
# ============================================

`;

let lastProcessedIndex = 0;

export function ensureFileExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, HEADER, 'utf-8');
  }
}

export function initializeWatchState(filePath: string): void {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const markerIndex = content.lastIndexOf(PROCESSED_MARKER);
    lastProcessedIndex = markerIndex >= 0 ? markerIndex + PROCESSED_MARKER.length : content.length;
  } else {
    lastProcessedIndex = 0;
  }
}

export function watchFile(filePath: string, onChange: (prompts: string[]) => void): FSWatcher {
  const watcher = watch(filePath, { persistent: true, ignoreInitial: true });
  watcher.on('change', () => {
    const prompts = parseNewPrompts(filePath);
    if (prompts.length > 0) {
      onChange(prompts);
    }
  });
  return watcher;
}

function isAgentMessage(text: string): boolean {
  const patterns = [/^\[AGENT/i, /^<<<PROCESSED>>>/, /^\[Write your response/i, /^# /, /^={3,}/];
  return patterns.some((p) => p.test(text.trim()));
}

export function parseNewPrompts(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const newContent = content.slice(lastProcessedIndex);
  const segments = newContent.split(/\n\n+/);
  return segments
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== PROCESSED_MARKER && !isAgentMessage(s));
}

export function markAsProcessed(filePath: string): void {
  fs.appendFileSync(filePath, `\n${PROCESSED_MARKER}\n`);
  const content = fs.readFileSync(filePath, 'utf-8');
  lastProcessedIndex = content.length;
}

export function appendToFile(filePath: string, message: string): void {
  const formatted = `\n[AGENT MESSAGE - ${new Date().toISOString()}]\n${message}\n`;
  fs.appendFileSync(filePath, formatted);
  const content = fs.readFileSync(filePath, 'utf-8');
  lastProcessedIndex = content.length;
}

export function clearFile(filePath: string): void {
  const header = `# Cursor Agent Notepad - Cleared at ${new Date().toISOString()}
# Write your prompts below, separated by double-enter (blank line)
# The agent will pick up each new prompt automatically
# Type "STOP" to end the session
# ============================================

`;
  fs.writeFileSync(filePath, header, 'utf-8');
  lastProcessedIndex = header.length;
}

export function readFileContent(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}
