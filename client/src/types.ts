export interface Project {
  hash: string;
  sessionCount: number;
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
  type: 'thought' | 'tool_use' | 'tool_result' | 'system' | 'thinking' | 'user_message' | 'agent_spawn' | 'agent_result' | 'response';
  timestamp: string;
  text?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolUseId?: string;
  resultToolUseId?: string;
  content?: string;
  isError?: boolean;
  // thinking
  thinkingText?: string;
  // agent_spawn / agent_result
  agentType?: string;
}
