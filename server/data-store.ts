import type { Project, SessionSummary, SessionDetail, SubAgentDetail } from './types';
import { scanProjects, loadSessionDetail, loadSubAgentDetail } from './session-scanner';

type UpdateCallback = (message: any) => void;

export class DataStore {
  private projects: Project[] = [];
  private sessionCache = new Map<string, SessionDetail>();
  private subscribers = new Set<UpdateCallback>();

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.projects = scanProjects();
  }

  getProjects(): Project[] {
    return this.projects;
  }

  getSessions(projectHash: string): SessionSummary[] {
    const project = this.projects.find((p) => p.hash === projectHash);
    return project?.sessions || [];
  }

  getSessionDetail(sessionId: string): SessionDetail | null {
    // 캐시 확인
    const cached = this.sessionCache.get(sessionId);
    if (cached) return cached;

    // 프로젝트 경로 찾기
    for (const project of this.projects) {
      const session = project.sessions.find((s) => s.id === sessionId);
      if (session) {
        const detail = loadSessionDetail(project.path, sessionId);
        if (detail) {
          this.sessionCache.set(sessionId, detail);
          return detail;
        }
      }
    }
    return null;
  }

  getSubAgentDetail(sessionId: string, agentId: string): SubAgentDetail | null {
    for (const project of this.projects) {
      const session = project.sessions.find((s) => s.id === sessionId);
      if (session) {
        return loadSubAgentDetail(project.path, sessionId, agentId);
      }
    }
    return null;
  }

  // 캐시 무효화 (파일 변경 시)
  invalidateSession(sessionId: string): void {
    this.sessionCache.delete(sessionId);
  }

  invalidateAll(): void {
    this.sessionCache.clear();
    this.refresh();
  }

  // WebSocket broadcast
  subscribe(callback: UpdateCallback): void {
    this.subscribers.add(callback);
  }

  unsubscribe(callback: UpdateCallback): void {
    this.subscribers.delete(callback);
  }

  broadcast(message: any): void {
    for (const cb of this.subscribers) {
      try {
        cb(message);
      } catch {}
    }
  }
}
