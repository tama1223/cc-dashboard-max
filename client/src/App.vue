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

// 패널 크기 (px) — localStorage에 저장
const leftWidth = ref(parseInt(localStorage.getItem('cc-leftWidth') || '280', 10));
const taskDetailHeight = ref(parseInt(localStorage.getItem('cc-taskDetailHeight') || '180', 10));

function startResizeLeft(e: MouseEvent) {
  e.preventDefault();
  const startX = e.clientX;
  const startW = leftWidth.value;
  const onMove = (ev: MouseEvent) => {
    leftWidth.value = Math.max(180, Math.min(600, startW + ev.clientX - startX));
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('cc-leftWidth', leftWidth.value.toString());
  };
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function startResizeTop(e: MouseEvent) {
  e.preventDefault();
  const startY = e.clientY;
  const startH = taskDetailHeight.value;
  const onMove = (ev: MouseEvent) => {
    taskDetailHeight.value = Math.max(60, Math.min(800, startH + ev.clientY - startY));
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('cc-taskDetailHeight', taskDetailHeight.value.toString());
  };
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

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
      <h1 class="text-sm font-bold text-blue-400">Agent Dashboard</h1>
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
      <div
        class="border-r border-gray-800 flex flex-col shrink-0 overflow-hidden"
        :style="{ width: leftWidth + 'px' }"
      >
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

      <!-- 좌우 리사이즈 핸들 -->
      <div
        class="w-1 bg-gray-800 hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
        @mousedown="startResizeLeft"
      />

      <!-- 우측 패널: 태스크 상세 + 스토리라인 -->
      <div class="flex-1 flex flex-col overflow-hidden min-w-0">
        <div
          v-if="sessionDetail"
          class="shrink-0 overflow-hidden"
          :style="{ height: taskDetailHeight + 'px' }"
        >
          <TaskDetail
            :session="sessionDetail"
            :selected-agent-id="selectedAgentId"
            :main-event-count="mainStoryEvents.length"
            @select-agent="selectAgent"
            @select-main="selectMain"
          />
        </div>
        <!-- 상하 리사이즈 핸들 -->
        <div
          v-if="sessionDetail"
          class="h-1 bg-gray-800 hover:bg-blue-500 cursor-row-resize shrink-0 transition-colors"
          @mousedown="startResizeTop"
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
          :session-id="selectedSessionId"
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
      :session-slug="sessionDetail?.slug || ''"
      @close="showSummary = false"
      @generate="fetchSummary()"
    />
  </div>
</template>
