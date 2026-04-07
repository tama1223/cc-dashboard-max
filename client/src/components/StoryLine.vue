<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import type { SubAgentDetail } from '../types';
import StoryEvent from './StoryEvent.vue';

const props = defineProps<{
  agent: SubAgentDetail;
}>();

const container = ref<HTMLElement | null>(null);

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
</script>

<template>
  <div class="flex flex-col overflow-hidden">
    <!-- 헤더 -->
    <div class="px-4 py-2 border-b border-gray-800 bg-gray-900/50 shrink-0 flex items-center gap-2">
      <span class="text-xs font-mono font-bold text-blue-400">
        {{ agent.agentType }}
      </span>
      <span class="text-xs text-gray-400">{{ agent.description }}</span>
      <span class="ml-auto text-xs text-gray-600">
        {{ agent.events.length }} events
      </span>
    </div>

    <!-- 이벤트 목록 -->
    <div ref="container" class="flex-1 overflow-y-auto px-4 py-2 space-y-1">
      <StoryEvent
        v-for="event in agent.events"
        :key="event.uuid"
        :event="event"
      />
    </div>
  </div>
</template>
