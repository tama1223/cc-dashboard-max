<script setup lang="ts">
import type { SessionDetail } from '../types';
import SubAgentCard from './SubAgentCard.vue';

defineProps<{
  session: SessionDetail;
  selectedAgentId: string;
  mainEventCount: number;
}>();

const emit = defineEmits<{
  'select-agent': [agentId: string];
  'select-main': [];
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
      <!-- Main Agent 카드 -->
      <div
        class="rounded-lg border bg-yellow-950/30 border-yellow-800 px-3 py-2 cursor-pointer transition-all min-w-48 max-w-64 hover:brightness-125"
        :class="!selectedAgentId ? 'ring-2 ring-yellow-500 scale-[1.02]' : ''"
        @click="emit('select-main')"
      >
        <div class="flex items-center gap-1.5 mb-1">
          <div class="w-2 h-2 rounded-full bg-yellow-500" />
          <span class="text-xs font-mono font-bold text-yellow-400">Main</span>
        </div>
        <div class="text-xs text-gray-300">Main Session Timeline</div>
        <div class="flex gap-2 mt-1 text-xs text-gray-500">
          <span>{{ mainEventCount }} events</span>
        </div>
      </div>

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
