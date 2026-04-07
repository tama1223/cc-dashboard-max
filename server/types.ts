// === JSONL Raw Types (파일에서 읽은 원본 구조) ===

export interface JsonlEntry {
  type: 'user' | 'assistant' | 'system' | 'file-history-snapshot' | 'permission-mode' | 'attachment';
  subtype?: string;
  parentUuid: string | null;
  uuid: string;
  timestamp: string;
  sessionId: string;
  isSidechain: boolean;
  agentId?: string;
  promptId?: string;
  message?: {
    role: 'user' | 'assistant';
    model?: string;
    content: string | ContentBlock[];
    stop_reason?: string;
    usage?: TokenUsage;
  };
  toolUseResult?: ToolUseResult;
  sourceToolAssistantUUID?: string;
  userType?: string;
  entrypoint?: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  slug?: string;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  // text block
  text?: string;
  // tool_use block
  id?: string;
  name?: string;
  input?: Record<string, any>;
  // tool_result block
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
  // thinking block
  thinking?: string;
}

export interface ToolUseResult {
  status?: string;
  agentId?: string;
  agentType?: string;
  prompt?: string;
  totalDurationMs?: number;
  totalTokens?: number;
  totalToolUseCount?: number;
  content?: any;
  usage?: TokenUsage;
  // 파일 관련 (Read/Write/Edit 결과)
  filePath?: string;
  oldString?: string;
  newString?: string;
}

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface SubAgentMeta {
  agentType: string;
  description: string;
}

// === Application Data Model ===

export interface Project {
  hash: string;
  path: string;
  sessions: SessionSummary[];
}

export interface SessionSummary {
  id: string;
  slug: string;
  startTime: string;
  lastActivity: string;
  isActive: boolean;
  subagentCount: number;
}

export interface SessionDetail {
  id: string;
  slug: string;
  startTime: string;
  lastActivity: string;
  isActive: boolean;
  tasks: Task[];
  subagents: SubAgentSummary[];
  mainEvents: StoryEvent[];
}

export interface Task {
  id: string;
  prompt: string;
  timestamp: string;
  spawnedAgents: SpawnedAgent[];
}

export interface SpawnedAgent {
  agentId: string;
  toolUseId: string;
  description: string;
  subagentType: string;
}

export interface SubAgentSummary {
  agentId: string;
  agentType: string;
  description: string;
  status: 'running' | 'completed' | 'error';
  totalDurationMs?: number;
  totalTokens?: number;
  totalToolUseCount?: number;
  startTime: string;
  endTime?: string;
}

export interface SubAgentDetail extends SubAgentSummary {
  events: StoryEvent[];
}

export interface StoryEvent {
  uuid: string;
  type: 'thought' | 'tool_use' | 'tool_result' | 'system' | 'thinking' | 'user_message' | 'agent_spawn' | 'agent_result';
  timestamp: string;
  // thought
  text?: string;
  // tool_use
  toolName?: string;
  toolInput?: Record<string, any>;
  toolUseId?: string;
  // tool_result
  resultToolUseId?: string;
  content?: string;
  isError?: boolean;
  // thinking
  thinkingText?: string;
  // agent_spawn / agent_result
  agentType?: string;
  // token usage (assistant 메시지)
  tokenUsage?: TokenUsage;
}

// === WebSocket Messages ===

export type WsClientMessage =
  | { type: 'subscribe'; sessionId: string }
  | { type: 'unsubscribe' };

export type WsServerMessage =
  | { type: 'sessions_updated'; data: SessionSummary[] }
  | { type: 'task_new'; sessionId: string; data: Task }
  | { type: 'agent_spawn'; sessionId: string; data: SubAgentSummary }
  | { type: 'agent_complete'; sessionId: string; agentId: string; data: Partial<SubAgentSummary> }
  | { type: 'agent_event'; sessionId: string; agentId: string; data: StoryEvent }
  | { type: 'main_event'; sessionId: string; data: StoryEvent }
  | { type: 'session_updated'; sessionId: string };
