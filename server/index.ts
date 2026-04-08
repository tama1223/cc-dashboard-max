import { DataStore } from './data-store';
import { FileWatcher } from './file-watcher';
import { summarizeSession, summarizeAgent } from './summarizer';

const PORT = 4002;

const store = new DataStore();
const watcher = new FileWatcher(store);

// WebSocket 클라이언트 관리
const wsClients = new Set<any>();

const server = Bun.serve({
  port: PORT,
  idleTimeout: 120, // Claude API 호출 대기 (기본 10초 → 120초)
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket 업그레이드
    if (url.pathname === '/ws') {
      if (server.upgrade(req)) return;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // REST API 라우팅
    return handleApi(url.pathname, req);
  },
  websocket: {
    open(ws) {
      wsClients.add(ws);
    },
    message(ws, message) {
      try {
        const msg = JSON.parse(String(message));
        if (msg.type === 'subscribe' && msg.sessionId) {
          // 세션 워치 시작
          const projects = store.getProjects();
          for (const project of projects) {
            const session = project.sessions.find((s) => s.id === msg.sessionId);
            if (session) {
              watcher.watchSession(project.path, msg.sessionId);
              break;
            }
          }
        }
      } catch {}
    },
    close(ws) {
      wsClients.delete(ws);
    },
  },
});

// DataStore broadcast → WebSocket 전송
store.subscribe((message) => {
  const data = JSON.stringify(message);
  for (const ws of wsClients) {
    try {
      ws.send(data);
    } catch {}
  }
});

async function handleApi(pathname: string, req: Request): Promise<Response> {
  // GET /api/projects
  if (pathname === '/api/projects') {
    store.invalidateAll();
    const projects = store.getProjects();
    return json(
      projects.map((p) => ({
        hash: p.hash,
        sessionCount: p.sessions.length,
        sessions: p.sessions,
      }))
    );
  }

  // GET /api/sessions/:projectHash
  const sessionsMatch = pathname.match(/^\/api\/sessions\/(.+)$/);
  if (sessionsMatch) {
    store.invalidateAll(); // 항상 최신 스캔
    const sessions = store.getSessions(decodeURIComponent(sessionsMatch[1]));
    return json(sessions);
  }

  // GET /api/session/:sessionId
  const sessionMatch = pathname.match(/^\/api\/session\/([^/]+)$/);
  if (sessionMatch) {
    store.invalidateSession(sessionMatch[1]); // 캐시 무효화 → 항상 최신
    const detail = store.getSessionDetail(sessionMatch[1]);
    if (!detail) return json({ error: 'Session not found' }, 404);
    return json(detail);
  }

  // GET /api/subagent/:sessionId/:agentId
  const subagentMatch = pathname.match(
    /^\/api\/subagent\/([^/]+)\/([^/]+)$/
  );
  if (subagentMatch) {
    const detail = store.getSubAgentDetail(subagentMatch[1], subagentMatch[2]);
    if (!detail) return json({ error: 'SubAgent not found' }, 404);
    return json(detail);
  }

  // GET /api/summarize/:sessionId
  const summarizeMatch = pathname.match(/^\/api\/summarize\/([^/]+)$/);
  if (summarizeMatch) {
    const sessionId = summarizeMatch[1];
    const detail = store.getSessionDetail(sessionId);
    if (!detail) return json({ error: 'Session not found' }, 404);

    // 모든 subagent detail 로드
    const subagentDetails = [];
    for (const sa of detail.subagents) {
      const saDetail = store.getSubAgentDetail(sessionId, sa.agentId);
      if (saDetail) subagentDetails.push(saDetail);
    }

    try {
      console.log(`[Summarize] Starting for session ${sessionId}, ${detail.mainEvents.length} main events, ${subagentDetails.length} subagents`);
      const summary = await summarizeSession(detail, subagentDetails);
      console.log(`[Summarize] Success, ${summary.length} chars`);
      return json({ summary });
    } catch (err: any) {
      console.error(`[Summarize] Error:`, err);
      return json({ error: err.message || 'Summarization failed' }, 500);
    }
  }

  // GET /api/summarize-agent/:sessionId/:agentId
  const summarizeAgentMatch = pathname.match(/^\/api\/summarize-agent\/([^/]+)\/([^/]+)$/);
  if (summarizeAgentMatch) {
    const [, sessionId, agentId] = summarizeAgentMatch;
    const agentDetail = store.getSubAgentDetail(sessionId, agentId);
    if (!agentDetail) return json({ error: 'Agent not found' }, 404);

    try {
      console.log(`[SummarizeAgent] ${agentDetail.agentType}: ${agentDetail.description}`);
      const summary = await summarizeAgent(agentDetail);
      console.log(`[SummarizeAgent] Success, ${summary.length} chars`);
      return json({ summary });
    } catch (err: any) {
      console.error(`[SummarizeAgent] Error:`, err);
      return json({ error: err.message || 'Summarization failed' }, 500);
    }
  }

  return json({ error: 'Not found' }, 404);
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

console.log(`CC Agent Dashboard server running on http://localhost:${PORT}`);
console.log(`WebSocket: ws://localhost:${PORT}/ws`);
console.log(`Projects found: ${store.getProjects().length}`);
for (const p of store.getProjects()) {
  console.log(`  ${p.hash}: ${p.sessions.length} sessions`);
}
