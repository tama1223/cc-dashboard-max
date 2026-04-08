import { readFileSync } from 'fs';
import type {
  JsonlEntry,
  ContentBlock,
  Task,
  SpawnedAgent,
  SubAgentMeta,
  SubAgentSummary,
  StoryEvent,
} from './types';

// === 파일 읽기 유틸 ===

export function readJsonlFile(filePath: string): JsonlEntry[] {
  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as JsonlEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is JsonlEntry => entry !== null);
}

export function readJsonlFromOffset(
  filePath: string,
  fromByte: number
): { entries: JsonlEntry[]; newOffset: number } {
  const buf = readFileSync(filePath);
  const slice = buf.subarray(fromByte);
  const text = slice.toString('utf-8');
  const lines = text.split('\n');

  // 마지막 줄이 불완전할 수 있으므로 완전한 줄만 파싱
  const entries: JsonlEntry[] = [];
  let bytesRead = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineBytes = Buffer.byteLength(line + (i < lines.length - 1 ? '\n' : ''), 'utf-8');

    if (i === lines.length - 1 && !text.endsWith('\n')) {
      // 마지막 줄이 개행으로 안 끝남 = 불완전한 줄
      break;
    }

    if (line.trim()) {
      try {
        entries.push(JSON.parse(line) as JsonlEntry);
      } catch {
        // 파싱 실패한 줄은 무시
      }
    }
    bytesRead += lineBytes;
  }

  return { entries, newOffset: fromByte + bytesRead };
}

export function readSubAgentMeta(metaPath: string): SubAgentMeta | null {
  try {
    const content = readFileSync(metaPath, 'utf-8');
    return JSON.parse(content) as SubAgentMeta;
  } catch {
    return null;
  }
}

// === 메인 JSONL 파싱 ===

export interface MainJsonlParsed {
  slug: string;
  startTime: string;
  lastActivity: string;
  tasks: Task[];
  agentCompletions: Map<string, AgentCompletion>;
  mainEvents: StoryEvent[];
}

export interface AgentCompletion {
  agentId: string;
  agentType: string;
  totalDurationMs?: number;
  totalTokens?: number;
  totalToolUseCount?: number;
  taskId?: string; // 어떤 태스크에서 스폰됐는지
}

export function parseMainJsonl(entries: JsonlEntry[]): MainJsonlParsed {
  let slug = '';
  let startTime = '';
  let lastActivity = '';

  const tasks: Task[] = [];
  const agentCompletions = new Map<string, AgentCompletion>();
  const mainEvents: StoryEvent[] = [];

  // promptId → Task 매핑 (같은 턴의 agent spawn을 태스크에 연결)
  const promptToTask = new Map<string, Task>();
  // tool_use id → 해당 tool_use가 속한 assistant message의 promptId
  const toolUseToPromptId = new Map<string, string>();

  for (const entry of entries) {
    // slug, 시간 추출
    if (entry.slug && !slug) slug = entry.slug;
    if (entry.timestamp) {
      if (!startTime) startTime = entry.timestamp;
      lastActivity = entry.timestamp;
    }

    // 태스크 식별: type=user, isSidechain=false, content가 문자열(사용자 프롬프트)
    if (
      entry.type === 'user' &&
      !entry.isSidechain &&
      entry.message?.role === 'user' &&
      typeof entry.message.content === 'string'
    ) {
      const task: Task = {
        id: entry.uuid,
        prompt: entry.message.content,
        timestamp: entry.timestamp,
        spawnedAgents: [],
      };
      tasks.push(task);
      if (entry.promptId) {
        promptToTask.set(entry.promptId, task);
      }
    }

    // Agent tool_use 감지 (assistant 메시지에서)
    if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
      for (const block of entry.message!.content as ContentBlock[]) {
        if (block.type === 'tool_use' && block.name === 'Agent') {
          const input = block.input || {};
          if (block.id && entry.promptId) {
            toolUseToPromptId.set(block.id, entry.promptId);
          }
        }
      }
    }

    // Agent 완료 감지 (toolUseResult에 agentId가 있는 경우)
    if (entry.type === 'user' && entry.toolUseResult?.agentId) {
      const tr = entry.toolUseResult;
      const completion: AgentCompletion = {
        agentId: tr.agentId!,
        agentType: tr.agentType || '',
        totalDurationMs: tr.totalDurationMs,
        totalTokens: tr.totalTokens,
        totalToolUseCount: tr.totalToolUseCount,
      };

      // tool_result의 tool_use_id로 어떤 태스크에서 온 건지 추적
      if (Array.isArray(entry.message?.content)) {
        for (const block of entry.message!.content as ContentBlock[]) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            const promptId = toolUseToPromptId.get(block.tool_use_id);
            if (promptId) {
              const task = promptToTask.get(promptId);
              if (task) {
                completion.taskId = task.id;
                // Agent input 정보도 태스크에 추가
                task.spawnedAgents.push({
                  agentId: tr.agentId!,
                  toolUseId: block.tool_use_id,
                  description: tr.agentType || '',
                  subagentType: tr.agentType || '',
                });
              }
            }
          }
        }
      }

      agentCompletions.set(tr.agentId!, completion);
    }

    // 기존 tasks/agentCompletions 로직 후에: main StoryEvent 변환
    const events = parseMainEntryToEvents(entry);
    mainEvents.push(...events);
  }

  return { slug, startTime, lastActivity, tasks, agentCompletions, mainEvents };
}

// === 메인 JSONL 엔트리 → StoryEvent 변환 ===

export function parseMainEntryToEvents(entry: JsonlEntry): StoryEvent[] {
  // 서브에이전트(사이드체인) 메시지는 main 스토리라인에 포함하지 않음
  if (entry.isSidechain) return [];

  // user 타입 + content가 문자열 (사용자 프롬프트 또는 시스템 주입 메시지)
  if (entry.type === 'user' && typeof entry.message?.content === 'string') {
    const content = entry.message.content;
    // task-notification, command-name 등 시스템 주입 메시지는 system으로 분류
    if (content.includes('<task-notification>') || content.includes('<command-name>')) {
      return [{
        type: 'system',
        uuid: entry.uuid,
        timestamp: entry.timestamp,
        text: content.includes('<task-notification>') ? '[Agent Task Notification]' : '[Command]',
      }];
    }
    return [{
      type: 'user_message',
      uuid: entry.uuid,
      timestamp: entry.timestamp,
      text: content,
    }];
  }

  // user 타입 + content가 배열 (tool_result 등)
  if (entry.type === 'user' && Array.isArray(entry.message?.content)) {
    const events: StoryEvent[] = [];
    for (const block of entry.message!.content as ContentBlock[]) {
      if (block.type === 'tool_result' && entry.toolUseResult?.agentId) {
        // agent_result
        events.push({
          type: 'agent_result',
          uuid: entry.uuid + '-agent-result',
          timestamp: entry.timestamp,
          agentType: entry.toolUseResult.agentType,
          content: extractToolResultText(block.content),
          tokenUsage: entry.toolUseResult.usage,
        });
      } else if (block.type === 'tool_result') {
        // 일반 tool_result
        events.push({
          type: 'tool_result',
          uuid: entry.uuid + '-result-' + block.tool_use_id,
          timestamp: entry.timestamp,
          resultToolUseId: block.tool_use_id,
          content: extractToolResultText(block.content),
          isError: block.is_error || false,
        });
      }
    }
    return events;
  }

  // assistant 타입 + content 배열
  if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
    const events: StoryEvent[] = [];
    for (const block of entry.message!.content as ContentBlock[]) {
      if (block.type === 'thinking') {
        if (block.thinking && block.thinking !== '') {
          events.push({
            type: 'thinking',
            uuid: entry.uuid + '-thinking',
            timestamp: entry.timestamp,
            thinkingText: block.thinking,
          });
        }
        // 빈 thinking 블록은 무시
      } else if (block.type === 'text' && block.text) {
        events.push({
          type: 'thought',
          uuid: entry.uuid + '-text',
          timestamp: entry.timestamp,
          text: block.text,
        });
      } else if (block.type === 'tool_use' && block.name === 'Agent') {
        events.push({
          type: 'agent_spawn',
          uuid: entry.uuid + '-' + (block.id || 'agent'),
          timestamp: entry.timestamp,
          toolName: 'Agent',
          toolInput: summarizeToolInput('Agent', block.input || {}),
          toolUseId: block.id,
          agentType: block.input?.subagent_type || 'general-purpose',
        });
      } else if (block.type === 'tool_use') {
        events.push({
          type: 'tool_use',
          uuid: entry.uuid + '-' + (block.id || 'tool'),
          timestamp: entry.timestamp,
          toolName: block.name || 'unknown',
          toolInput: summarizeToolInput(block.name || '', block.input || {}),
          toolUseId: block.id,
        });
      }
    }
    return events;
  }

  // system 타입
  if (entry.type === 'system') {
    return [{
      type: 'system',
      uuid: entry.uuid,
      timestamp: entry.timestamp,
      text: (entry as any).content || entry.subtype || 'system',
    }];
  }

  // 나머지 (permission-mode, file-history-snapshot, attachment)
  return [];
}

// === 서브에이전트 JSONL 파싱 ===

export function parseSubAgentJsonl(entries: JsonlEntry[]): StoryEvent[] {
  const events: StoryEvent[] = [];

  for (const entry of entries) {
    // 서브에이전트 초기 prompt (첫 user 메시지, 문자열 content)
    if (
      entry.type === 'user' &&
      entry.message?.role === 'user' &&
      typeof entry.message.content === 'string'
    ) {
      events.push({
        uuid: entry.uuid + '-prompt',
        type: 'user_message',
        timestamp: entry.timestamp,
        text: entry.message.content,
      });
    }

    if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
      const isFinalResponse = entry.message?.stop_reason === 'end_turn';
      for (const block of entry.message!.content as ContentBlock[]) {
        if (block.type === 'thinking' && block.thinking && block.thinking !== '') {
          events.push({
            uuid: entry.uuid + '-thinking',
            type: 'thinking',
            timestamp: entry.timestamp,
            thinkingText: block.thinking,
          });
        }
        if (block.type === 'text' && block.text) {
          events.push({
            uuid: entry.uuid + '-text',
            type: isFinalResponse ? 'response' : 'thought',
            timestamp: entry.timestamp,
            text: block.text,
          });
        }
        if (block.type === 'tool_use') {
          events.push({
            uuid: entry.uuid + '-' + (block.id || 'tool'),
            type: 'tool_use',
            timestamp: entry.timestamp,
            toolName: block.name || 'unknown',
            toolInput: summarizeToolInput(block.name || '', block.input || {}),
            toolUseId: block.id,
          });
        }
      }
    }

    if (entry.type === 'user' && Array.isArray(entry.message?.content)) {
      for (const block of entry.message!.content as ContentBlock[]) {
        if (block.type === 'tool_result') {
          const resultText = extractToolResultText(block.content);
          events.push({
            uuid: entry.uuid + '-result-' + (block.tool_use_id || ''),
            type: 'tool_result',
            timestamp: entry.timestamp,
            resultToolUseId: block.tool_use_id,
            content: resultText,
            isError: block.is_error || false,
          });
        }
      }
    }

    if (entry.type === 'system') {
      events.push({
        uuid: entry.uuid,
        type: 'system',
        timestamp: entry.timestamp,
        text: entry.subtype || 'system',
      });
    }
  }

  return events;
}

// === 유틸 ===

function summarizeToolInput(
  toolName: string,
  input: Record<string, any>
): Record<string, any> {
  // tool 입력에서 핵심 필드만 추출 (너무 긴 내용 방지)
  const summary: Record<string, any> = {};

  switch (toolName) {
    case 'Read':
      summary.file_path = shortenPath(input.file_path || '');
      if (input.offset) summary.offset = input.offset;
      if (input.limit) summary.limit = input.limit;
      break;
    case 'Write':
      summary.file_path = shortenPath(input.file_path || '');
      summary.content_length = (input.content || '').length;
      break;
    case 'Edit':
      summary.file_path = shortenPath(input.file_path || '');
      break;
    case 'Bash':
      summary.command = (input.command || '').substring(0, 200);
      break;
    case 'Glob':
      summary.pattern = input.pattern || '';
      if (input.path) summary.path = shortenPath(input.path);
      break;
    case 'Grep':
      summary.pattern = input.pattern || '';
      if (input.path) summary.path = shortenPath(input.path);
      break;
    case 'Agent':
      summary.description = input.description || '';
      summary.subagent_type = input.subagent_type || '';
      break;
    default:
      // 기타 도구: 각 필드를 200자로 잘라서 포함
      for (const [key, val] of Object.entries(input)) {
        if (typeof val === 'string') {
          summary[key] = val.substring(0, 200);
        } else {
          summary[key] = val;
        }
      }
  }

  return summary;
}

function shortenPath(fullPath: string): string {
  // 경로의 마지막 3개 세그먼트만
  const parts = fullPath.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) return fullPath;
  return '.../' + parts.slice(-3).join('/');
}

function extractToolResultText(content: string | ContentBlock[] | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content.substring(0, 2000);
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block.type === 'text' && block.text) return block.text;
        return '';
      })
      .join('\n')
      .substring(0, 2000);
  }
  return String(content).substring(0, 2000);
}
