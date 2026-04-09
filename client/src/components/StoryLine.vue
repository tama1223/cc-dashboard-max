<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import type { SubAgentDetail } from '../types';
import StoryEvent from './StoryEvent.vue';

const props = defineProps<{
  agent: SubAgentDetail;
  sessionId: string;
}>();

const container = ref<HTMLElement | null>(null);
const agentSummary = ref('');
const summaryLoading = ref(false);
const showSummary = ref(false);

async function fetchAgentSummary() {
  summaryLoading.value = true;
  agentSummary.value = '';
  showSummary.value = true;

  try {
    const res = await fetch(`/api/summarize-agent/${props.sessionId}/${props.agent.agentId}`);
    const data = await res.json();
    agentSummary.value = data.summary || data.error || '요약 생성 실패';
  } catch {
    agentSummary.value = '요약 요청 중 오류가 발생했습니다.';
  } finally {
    summaryLoading.value = false;
  }
}

// 새 이벤트 추가 시 자동 스크롤
watch(
  () => props.agent.events.length,
  async () => {
    await nextTick();
    if (container.value) {
      container.value.scrollTop = container.value.scrollHeight;
    }
  }
);

// 에이전트 변경 시 요약 초기화
watch(
  () => props.agent.agentId,
  () => {
    agentSummary.value = '';
    showSummary.value = false;
  }
);
</script>

<template>
  <div class="flex flex-col overflow-hidden">
    <!-- 헤더 -->
    <div class="px-4 py-2 border-b border-gray-800 bg-gray-900/50 shrink-0 flex items-center gap-2">
      <span class="text-xs font-mono font-bold text-blue-400">
        {{ agent.agentType }}
      </span>
      <span class="text-xs text-gray-400">{{ agent.description }}</span>
      <button
        @click="fetchAgentSummary"
        :disabled="summaryLoading"
        class="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2 py-0.5 rounded border border-blue-700/50 transition-colors disabled:opacity-50"
      >
        {{ summaryLoading ? '...' : 'Summary' }}
      </button>
      <span class="text-xs font-mono text-gray-600 select-all">{{ agent.agentId }}</span>
      <span class="ml-auto text-xs text-gray-600">
        {{ agent.events.length }} events
      </span>
    </div>

    <!-- 에이전트 요약 (접기 가능) -->
    <div v-if="showSummary" class="px-4 py-2 border-b border-gray-800 bg-blue-950/20">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-bold text-blue-400">Agent Summary</span>
        <button @click="showSummary = false" class="text-xs text-gray-500 hover:text-gray-300">&times;</button>
      </div>
      <div v-if="summaryLoading" class="flex items-center gap-2 py-2">
        <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span class="text-xs text-gray-400">요약 생성 중...</span>
      </div>
      <div v-else class="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
        {{ agentSummary }}
      </div>
    </div>

    <!-- 이벤트 목록 -->
    <div ref="container" class="flex-1 overflow-y-auto px-4 py-2 space-y-1">
      <StoryEvent
        v-for="event in agent.events"
        :key="event.uuid"
        :event="event"
        :is-sub-agent="true"
      />
    </div>
  </div>
</template>
