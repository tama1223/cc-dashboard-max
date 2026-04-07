<script setup lang="ts">
import type { Task, SubAgentSummary } from '../types';

const props = defineProps<{
  tasks: Task[];
  subagents: SubAgentSummary[];
  selectedAgentId: string;
}>();

const emit = defineEmits<{
  'select-agent': [agentId: string];
}>();

// 서브에이전트가 있는 태스크만 필터 + 전체 서브에이전트 목록도 표시
function formatTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function truncate(text: string, max: number): string {
  // command-name 태그 등 제거
  const cleaned = text.replace(/<[^>]+>/g, '').trim();
  return cleaned.length > max ? cleaned.substring(0, max) + '...' : cleaned;
}

function agentTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'worker-agent': 'text-orange-400',
    'qa-agent': 'text-green-400',
    'wiki-agent': 'text-purple-400',
    'Explore': 'text-cyan-400',
    'Plan': 'text-yellow-400',
    'claude-code-guide': 'text-pink-400',
    'general-purpose': 'text-gray-400',
  };
  return colors[type] || 'text-gray-400';
}

function statusIcon(status: string): string {
  return status === 'running' ? '⟳' : status === 'completed' ? '✓' : '✗';
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-950">
      Sub-Agents ({{ subagents.length }})
    </div>

    <!-- 서브에이전트 목록 (시간순) -->
    <div
      v-for="sa in subagents"
      :key="sa.agentId"
      @click="emit('select-agent', sa.agentId)"
      class="px-3 py-2 cursor-pointer border-l-2 transition-colors"
      :class="sa.agentId === selectedAgentId
        ? 'border-blue-500 bg-gray-800/50'
        : 'border-transparent hover:bg-gray-900'"
    >
      <div class="flex items-center gap-1.5">
        <span class="text-xs" :class="sa.status === 'running' ? 'animate-spin' : ''">
          {{ statusIcon(sa.status) }}
        </span>
        <span class="text-xs font-mono" :class="agentTypeColor(sa.agentType)">
          {{ sa.agentType }}
        </span>
      </div>
      <div class="text-xs text-gray-300 mt-0.5 truncate">
        {{ sa.description }}
      </div>
      <div class="flex gap-3 text-xs text-gray-600 mt-0.5">
        <span>{{ formatTime(sa.startTime) }}</span>
        <span v-if="sa.totalTokens">{{ (sa.totalTokens / 1000).toFixed(1) }}k tok</span>
        <span v-if="sa.totalToolUseCount">{{ sa.totalToolUseCount }} tools</span>
        <span v-if="sa.totalDurationMs">{{ (sa.totalDurationMs / 1000).toFixed(0) }}s</span>
      </div>
    </div>

    <div v-if="subagents.length === 0" class="px-3 py-4 text-xs text-gray-600 text-center">
      이 세션에 서브에이전트가 없습니다
    </div>
  </div>
</template>
