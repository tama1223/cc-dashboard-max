import { ref, computed } from 'vue';
import type { Project, SessionDetail, SubAgentDetail, StoryEvent } from '../types';

const API_BASE = '/api';

const projects = ref<Project[]>([]);
const selectedProjectHash = ref<string>('');
const selectedSessionId = ref<string>('');
const selectedAgentId = ref<string>('');
const sessionDetail = ref<SessionDetail | null>(null);
const agentDetail = ref<SubAgentDetail | null>(null);
const loading = ref(false);

const selectedProject = computed(() =>
  projects.value.find((p) => p.hash === selectedProjectHash.value) || null
);

const sessions = computed(() => selectedProject.value?.sessions || []);

export function useSessionData() {
  async function fetchProjects() {
    const res = await fetch(`${API_BASE}/projects`);
    projects.value = await res.json();

    // 자동 선택: 세션이 가장 많은 프로젝트
    if (!selectedProjectHash.value && projects.value.length > 0) {
      const sorted = [...projects.value].sort(
        (a, b) => b.sessionCount - a.sessionCount
      );
      selectedProjectHash.value = sorted[0].hash;
    }
  }

  async function selectSession(sessionId: string) {
    selectedSessionId.value = sessionId;
    selectedAgentId.value = '';
    agentDetail.value = null;
    loading.value = true;

    try {
      const res = await fetch(`${API_BASE}/session/${sessionId}`);
      sessionDetail.value = await res.json();
    } finally {
      loading.value = false;
    }
  }

  async function selectAgent(agentId: string) {
    if (!selectedSessionId.value) return;
    selectedAgentId.value = agentId;
    loading.value = true;

    try {
      const res = await fetch(
        `${API_BASE}/subagent/${selectedSessionId.value}/${agentId}`
      );
      agentDetail.value = await res.json();
    } finally {
      loading.value = false;
    }
  }

  function selectProject(hash: string) {
    selectedProjectHash.value = hash;
    selectedSessionId.value = '';
    selectedAgentId.value = '';
    sessionDetail.value = null;
    agentDetail.value = null;
  }

  // 실시간 이벤트 추가
  function appendAgentEvent(agentId: string, event: StoryEvent) {
    if (agentDetail.value && agentDetail.value.agentId === agentId) {
      agentDetail.value.events.push(event);
    }
  }

  function handleSessionUpdated(sessionId: string) {
    if (selectedSessionId.value === sessionId) {
      selectSession(sessionId); // 리로드
    }
  }

  return {
    projects,
    sessions,
    selectedProjectHash,
    selectedSessionId,
    selectedAgentId,
    sessionDetail,
    agentDetail,
    loading,
    fetchProjects,
    selectProject,
    selectSession,
    selectAgent,
    appendAgentEvent,
    handleSessionUpdated,
  };
}
