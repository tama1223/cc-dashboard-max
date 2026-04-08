<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import SessionList from './components/SessionList.vue';
import TaskList from './components/TaskList.vue';
import TaskDetail from './components/TaskDetail.vue';
import StoryLine from './components/StoryLine.vue';
import MainStoryLine from './components/MainStoryLine.vue';
import SessionSummary from './components/SessionSummary.vue';
import { useSessionData } from './composables/useSessionData';
import { useWebSocket } from './composables/useWebSocket';

const {
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
  mainStoryEvents,
  viewTarget,
  appendAgentEvent,
  appendMainEvent,
  selectMain,
  handleSessionUpdated,
  sessionSummary,
  summaryLoading,
  fetchSummary,
} = useSessionData();

const showSummary = ref(false);

const { connected, connect, subscribe } = useWebSocket();

let pollTimer: ReturnType<typeof setInterval>;

onMounted(async () => {
  await fetchProjects();

  connect((msg) => {
    if (msg.type === 'session_updated') {
      handleSessionUpdated(msg.sessionId);
    } else if (msg.type === 'agent_event') {
      appendAgentEvent(msg.agentId, msg.data);
    } else if (msg.type === 'agent_spawn' || msg.type === 'agent_complete') {
      handleSessionUpdated(msg.sessionId);
    } else if (msg.type === 'main_event') {
      appendMainEvent(msg.data);
    }
  });

  // 30초마다 세션 목록 갱신 (isActive 상태 등)
  pollTimer = setInterval(() => fetchProjects(), 30000);
});

onUnmounted(() => {
  clearInterval(pollTimer);
});

// 세션 선택 시 WebSocket 구독
watch(selectedSessionId, (id) => {
  if (id) subscribe(id);
});
</script>

<template>
  <div class="h-screen flex flex-col relative">
    <!-- 헤더 -->
    <header class="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-3 shrink-0">
      <h1 class="text-sm font-bold text-blue-400">CC Agent Dashboard Max</h1>
      <div
        class="w-2 h-2 rounded-full"
        :class="connected ? 'bg-green-500' : 'bg-red-500'"
        :title="connected ? 'WebSocket connected' : 'Disconnected'"
      />

      <!-- 프로젝트 선택 -->
      <select
        v-if="projects.length > 1"
        :value="selectedProjectHash"
        @change="selectProject(($event.target as HTMLSelectElement).value)"
        class="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border border-gray-700"
      >
        <option v-for="p in projects" :key="p.hash" :value="p.hash">
          {{ p.hash.replace(/^[A-Z]--/, '').replaceAll('-', '/') }} ({{ p.sessionCount }})
        </option>
      </select>

      <button
        v-if="sessionDetail"
        @click="showSummary = true"
        class="text-xs bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 px-2 py-1 rounded border border-yellow-700/50 transition-colors"
      >
        Summary
      </button>
    </header>

    <!-- 메인 콘텐츠 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 좌측 패널: 세션 + 태스크 -->
      <div class="w-80 border-r border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <SessionList
          :sessions="sessions"
          :selected-id="selectedSessionId"
          @select="selectSession"
        />
        <TaskList
          v-if="sessionDetail"
          :tasks="sessionDetail.tasks"
          :subagents="sessionDetail.subagents"
          :selected-agent-id="selectedAgentId"
          :view-target="viewTarget"
          @select-agent="selectAgent"
          @select-main="selectMain"
        />
      </div>

      <!-- 우측 패널: 태스크 상세 + 스토리라인 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <TaskDetail
          v-if="sessionDetail"
          :session="sessionDetail"
          :selected-agent-id="selectedAgentId"
          :main-event-count="mainStoryEvents.length"
          @select-agent="selectAgent"
          @select-main="selectMain"
        />
        <!-- Main 스토리라인 -->
        <MainStoryLine
          v-if="viewTarget === 'main' && sessionDetail && mainStoryEvents.length > 0"
          :events="mainStoryEvents"
          :session="sessionDetail"
          class="flex-1"
        />
        <!-- 서브에이전트 스토리라인 -->
        <StoryLine
          v-else-if="viewTarget === 'subagent' && agentDetail"
          :agent="agentDetail"
          class="flex-1"
        />
        <div
          v-else-if="sessionDetail && viewTarget === 'main' && mainStoryEvents.length === 0"
          class="flex-1 flex items-center justify-center text-gray-600"
        >
          메인 세션 이벤트를 로딩 중...
        </div>
        <div
          v-else-if="!sessionDetail"
          class="flex-1 flex items-center justify-center text-gray-600"
        >
          세션을 선택하세요
        </div>
      </div>
    </div>

    <SessionSummary
      :summary="sessionSummary"
      :loading="summaryLoading"
      :visible="showSummary"
      @close="showSummary = false"
      @generate="fetchSummary()"
    />
  </div>
</template>
