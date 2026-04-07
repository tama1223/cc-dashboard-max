<script setup lang="ts">
import type { SessionDetail } from '../types';
import SubAgentCard from './SubAgentCard.vue';

defineProps<{
  session: SessionDetail;
  selectedAgentId: string;
}>();

const emit = defineEmits<{
  'select-agent': [agentId: string];
}>();
</script>

<template>
  <div class="border-b border-gray-800 p-4 shrink-0" style="max-height: 35%">
    <div class="flex items-center gap-2 mb-3">
      <h2 class="text-sm font-bold text-gray-300">{{ session.slug }}</h2>
      <span class="text-xs text-gray-600">
        {{ session.tasks.length }} tasks / {{ session.subagents.length }} agents
      </span>
    </div>

    <!-- 서브에이전트 카드 그리드 -->
    <div class="flex flex-wrap gap-2 overflow-y-auto" style="max-height: calc(100% - 2rem)">
      <SubAgentCard
        v-for="sa in session.subagents"
        :key="sa.agentId"
        :agent="sa"
        :selected="sa.agentId === selectedAgentId"
        @click="emit('select-agent', sa.agentId)"
      />
    </div>
  </div>
</template>
