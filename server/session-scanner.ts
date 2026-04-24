import { readdirSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type { Project, SessionSummary, SubAgentSummary, SessionDetail, SubAgentDetail } from './types';
import {
  readJsonlFile,
  readSubAgentMeta,
  parseMainJsonl,
  parseSubAgentJsonl,
} from './jsonl-parser';

const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

// 최근 활성 판단 기준: 5분 이내 수정
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;

export function scanProjects(): Project[] {
  if (!existsSync(CLAUDE_PROJECTS_DIR)) return [];

  const projects: Project[] = [];
  const entries = readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectPath = join(CLAUDE_PROJECTS_DIR, entry.name);
    const sessions = scanSessions(projectPath);

    if (sessions.length > 0) {
      projects.push({
        hash: entry.name,
        path: projectPath,
        sessions,
      });
    }
  }

  return projects;
}

export function scanSessions(projectPath: string): SessionSummary[] {
  const sessions: SessionSummary[] = [];
  const entries = readdirSync(projectPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;

    const sessionId = entry.name.replace('.jsonl', '');
    const filePath = join(projectPath, entry.name);
    const stat = statSync(filePath);

    // 서브에이전트 디렉토리 확인
    const subagentDir = join(projectPath, sessionId, 'subagents');
    let subagentCount = 0;
    if (existsSync(subagentDir)) {
      subagentCount = readdirSync(subagentDir).filter((f) =>
        f.endsWith('.meta.json')
      ).length;
    }

    const isActive =
      Date.now() - stat.mtimeMs < ACTIVE_THRESHOLD_MS;

    // 빠른 스캔: 첫/마지막 줄에서 slug, 시간만 추출
    const { slug, startTime, lastActivity } = quickScanJsonl(filePath);

    sessions.push({
      id: sessionId,
      slug: slug || sessionId.substring(0, 8),
      startTime,
      lastActivity,
      isActive,
      subagentCount,
    });
  }

  // 최신순 정렬
  sessions.sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );

  return sessions;
}

function quickScanJsonl(filePath: string): {
  slug: string;
  startTime: string;
  lastActivity: string;
} {
  const { readFileSync, openSync, readSync, closeSync, fstatSync } = require('fs');

  let slug = '';
  let startTime = '';
  let lastActivity = '';

  // 마지막 4KB에서 slug + lastActivity 추출
  const fd = openSync(filePath, 'r');
  const fstat = fstatSync(fd);
  const tailSize = Math.min(fstat.size, 4096);
  const tailBuf = Buffer.alloc(tailSize);
  readSync(fd, tailBuf, 0, tailSize, fstat.size - tailSize);

  const tailLines = tailBuf.toString('utf-8').split('\n').filter((l: string) => l.trim());
  for (let i = tailLines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(tailLines[i]);
      if (!lastActivity && obj.timestamp) lastActivity = obj.timestamp;
      if (!slug && obj.slug) slug = obj.slug;
      if (slug && lastActivity) break;
    } catch {}
  }

  // 첫 2KB에서 startTime 추출
  const headSize = Math.min(fstat.size, 2048);
  const headBuf = Buffer.alloc(headSize);
  readSync(fd, headBuf, 0, headSize, 0);
  closeSync(fd);

  const headLines = headBuf.toString('utf-8').split('\n');
  for (const line of headLines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.timestamp) { startTime = obj.timestamp; break; }
    } catch {}
  }

  return { slug, startTime, lastActivity };
}

// === 세션 상세 로드 (lazy) ===

export function loadSessionDetail(
  projectPath: string,
  sessionId: string
): SessionDetail | null {
  const jsonlPath = join(projectPath, `${sessionId}.jsonl`);
  if (!existsSync(jsonlPath)) return null;

  const entries = readJsonlFile(jsonlPath);
  const parsed = parseMainJsonl(entries);
  const stat = statSync(jsonlPath);
  const isActive = Date.now() - stat.mtimeMs < ACTIVE_THRESHOLD_MS;

  // 서브에이전트 정보 로드
  const subagentDir = join(projectPath, sessionId, 'subagents');
  const subagents = loadSubAgentSummaries(subagentDir, parsed.agentCompletions);

  // 태스크의 spawnedAgents에 meta.json 정보 보강
  for (const task of parsed.tasks) {
    for (const sa of task.spawnedAgents) {
      const sub = subagents.find((s) => s.agentId === sa.agentId);
      if (sub) {
        sa.description = sub.description;
        sa.subagentType = sub.agentType;
      }
    }
  }

  return {
    id: sessionId,
    slug: parsed.slug,
    startTime: parsed.startTime,
    lastActivity: parsed.lastActivity,
    isActive,
    tasks: parsed.tasks,
    subagents,
    mainEvents: parsed.mainEvents,
  };
}

function loadSubAgentSummaries(
  subagentDir: string,
  completions: Map<string, any>
): SubAgentSummary[] {
  if (!existsSync(subagentDir)) return [];

  const summaries: SubAgentSummary[] = [];
  const files = readdirSync(subagentDir);

  for (const file of files) {
    if (!file.endsWith('.meta.json')) continue;

    const agentId = file.replace('agent-', '').replace('.meta.json', '');
    const metaPath = join(subagentDir, file);
    const meta = readSubAgentMeta(metaPath);
    if (!meta) continue;

    const jsonlPath = join(subagentDir, `agent-${agentId}.jsonl`);
    const completion = completions.get(agentId);

    // JSONL에서 시작/종료 시간
    let startTime = '';
    let endTime = '';
    let status: 'running' | 'completed' | 'error' = 'running';

    if (existsSync(jsonlPath)) {
      const stat = statSync(jsonlPath);
      const isRecentlyModified = Date.now() - stat.mtimeMs < ACTIVE_THRESHOLD_MS;

      // 첫/마지막 줄에서 시간 추출
      const { startTime: st, lastActivity: la } = quickScanJsonl(jsonlPath);
      startTime = st;
      endTime = la;

      if (completion) {
        status = 'completed';
      } else if (!isRecentlyModified) {
        status = 'completed'; // 오래 전에 수정 멈춤 = 완료로 간주
      }
    }

    summaries.push({
      agentId,
      agentType: meta.agentType,
      description: meta.description,
      status,
      totalDurationMs: completion?.totalDurationMs,
      totalTokens: completion?.totalTokens,
      totalToolUseCount: completion?.totalToolUseCount,
      startTime,
      endTime,
    });
  }

  // 최신순 정렬 (최근에 시작한 에이전트가 위에)
  summaries.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  return summaries;
}

// === 서브에이전트 스토리라인 로드 ===

export function loadSubAgentDetail(
  projectPath: string,
  sessionId: string,
  agentId: string
): SubAgentDetail | null {
  const subagentDir = join(projectPath, sessionId, 'subagents');
  const metaPath = join(subagentDir, `agent-${agentId}.meta.json`);
  const jsonlPath = join(subagentDir, `agent-${agentId}.jsonl`);

  if (!existsSync(metaPath) || !existsSync(jsonlPath)) return null;

  const meta = readSubAgentMeta(metaPath);
  if (!meta) return null;

  const entries = readJsonlFile(jsonlPath);
  const events = parseSubAgentJsonl(entries);

  const stat = statSync(jsonlPath);
  const isRecentlyModified = Date.now() - stat.mtimeMs < ACTIVE_THRESHOLD_MS;

  // 메인 JSONL에서 completion 정보
  const mainJsonlPath = join(projectPath, `${sessionId}.jsonl`);
  let completion: any = null;
  if (existsSync(mainJsonlPath)) {
    const mainEntries = readJsonlFile(mainJsonlPath);
    const parsed = parseMainJsonl(mainEntries);
    completion = parsed.agentCompletions.get(agentId);
  }

  return {
    agentId,
    agentType: meta.agentType,
    description: meta.description,
    status: completion ? 'completed' : isRecentlyModified ? 'running' : 'completed',
    totalDurationMs: completion?.totalDurationMs,
    totalTokens: completion?.totalTokens,
    totalToolUseCount: completion?.totalToolUseCount,
    startTime: entries[0]?.timestamp || '',
    endTime: entries[entries.length - 1]?.timestamp || '',
    events,
  };
}
