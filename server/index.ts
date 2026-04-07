import { DataStore } from './data-store';
import { FileWatcher } from './file-watcher';

const PORT = 4002;

const store = new DataStore();
const watcher = new FileWatcher(store);

// WebSocket 클라이언트 관리
const wsClients = new Set<any>();

const server = Bun.serve({
  port: PORT,
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

function handleApi(pathname: string, req: Request): Response {
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
