import { watch, statSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { FSWatcher } from 'fs';
import type { DataStore } from './data-store';
import { readJsonlFromOffset, readSubAgentMeta, parseSubAgentJsonl, readJsonlFile, parseMainJsonl } from './jsonl-parser';
import type { StoryEvent } from './types';

export class FileWatcher {
  private watchers = new Map<string, FSWatcher>();
  private offsets = new Map<string, number>();
  private debounceTimers = new Map<string, Timer>();
  private store: DataStore;
  private watchedSessionId: string | null = null;
  private projectPath: string | null = null;

  constructor(store: DataStore) {
    this.store = store;
  }

  watchSession(projectPath: string, sessionId: string): void {
    // 기존 워치 정리
    this.stopAll();

    this.watchedSessionId = sessionId;
    this.projectPath = projectPath;

    const mainJsonlPath = join(projectPath, `${sessionId}.jsonl`);
    const subagentDir = join(projectPath, sessionId, 'subagents');

    // 메인 JSONL 워치
    if (existsSync(mainJsonlPath)) {
      this.watchFile(mainJsonlPath, 'main');
      const stat = statSync(mainJsonlPath);
      this.offsets.set(mainJsonlPath, stat.size);
    }

    // 서브에이전트 디렉토리 워치 (새 파일 감지)
    if (existsSync(subagentDir)) {
      this.watchDirectory(subagentDir);

      // 기존 서브에이전트 JSONL들 워치
      const files = readdirSync(subagentDir);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const filePath = join(subagentDir, file);
          const agentId = file.replace('agent-', '').replace('.jsonl', '');
          this.watchFile(filePath, `agent:${agentId}`);
          const stat = statSync(filePath);
          this.offsets.set(filePath, stat.size);
        }
      }
    }
  }

  private watchFile(filePath: string, tag: string): void {
    if (this.watchers.has(filePath)) return;

    try {
      const watcher = watch(filePath, (eventType) => {
        if (eventType === 'change') {
          this.debouncedHandleChange(filePath, tag);
        }
      });
      this.watchers.set(filePath, watcher);
    } catch (err) {
      console.error(`Failed to watch ${filePath}:`, err);
    }
  }

  private watchDirectory(dirPath: string): void {
    if (this.watchers.has(dirPath)) return;

    try {
      const watcher = watch(dirPath, (eventType, filename) => {
        if (filename && filename.endsWith('.jsonl') && eventType === 'rename') {
          // 새 서브에이전트 JSONL 파일 생성됨
          const filePath = join(dirPath, filename);
          if (existsSync(filePath)) {
            const agentId = filename.replace('agent-', '').replace('.jsonl', '');
            this.watchFile(filePath, `agent:${agentId}`);
            this.offsets.set(filePath, 0);

            // meta.json 확인
            const metaPath = join(dirPath, `agent-${agentId}.meta.json`);
            if (existsSync(metaPath)) {
              const meta = readSubAgentMeta(metaPath);
              if (meta && this.watchedSessionId) {
                this.store.invalidateSession(this.watchedSessionId);
                this.store.broadcast({
                  type: 'agent_spawn',
                  sessionId: this.watchedSessionId,
                  data: {
                    agentId,
                    agentType: meta.agentType,
                    description: meta.description,
                    status: 'running',
                    startTime: new Date().toISOString(),
                  },
                });
              }
            }
          }
        }
      });
      this.watchers.set(dirPath, watcher);
    } catch (err) {
      console.error(`Failed to watch directory ${dirPath}:`, err);
    }
  }

  private debouncedHandleChange(filePath: string, tag: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      filePath,
      setTimeout(() => {
        this.handleChange(filePath, tag);
        this.debounceTimers.delete(filePath);
      }, 100)
    );
  }

  private handleChange(filePath: string, tag: string): void {
    const fromOffset = this.offsets.get(filePath) || 0;
    const { entries, newOffset } = readJsonlFromOffset(filePath, fromOffset);
    this.offsets.set(filePath, newOffset);

    if (entries.length === 0) return;

    if (tag === 'main' && this.watchedSessionId) {
      // 메인 JSONL 변경 → 캐시 무효화 + 새 태스크/에이전트 감지
      this.store.invalidateSession(this.watchedSessionId);
      this.store.broadcast({
        type: 'session_updated',
        sessionId: this.watchedSessionId,
      });
    } else if (tag.startsWith('agent:') && this.watchedSessionId) {
      const agentId = tag.replace('agent:', '');

      // 새 이벤트들을 StoryEvent로 파싱
      const events: StoryEvent[] = [];
      for (const entry of entries) {
        const parsed = parseSubAgentJsonl([entry]);
        events.push(...parsed);
      }

      for (const event of events) {
        this.store.broadcast({
          type: 'agent_event',
          sessionId: this.watchedSessionId,
          agentId,
          data: event,
        });
      }

      // stop_reason: "end_turn" 감지 → 에이전트 완료
      for (const entry of entries) {
        if (
          entry.type === 'assistant' &&
          entry.message?.stop_reason === 'end_turn'
        ) {
          this.store.invalidateSession(this.watchedSessionId);
          this.store.broadcast({
            type: 'agent_complete',
            sessionId: this.watchedSessionId,
            agentId,
            data: { status: 'completed' },
          });
        }
      }
    }
  }

  stopAll(): void {
    for (const [, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    this.offsets.clear();
    for (const [, timer] of this.debounceTimers) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.watchedSessionId = null;
    this.projectPath = null;
  }
}
