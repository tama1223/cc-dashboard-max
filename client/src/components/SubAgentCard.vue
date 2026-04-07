<script setup lang="ts">
import type { SubAgentSummary } from '../types';

defineProps<{
  agent: SubAgentSummary;
  selected: boolean;
}>();

function agentTypeBg(type: string): string {
  const colors: Record<string, string> = {
    'worker-agent': 'bg-orange-950 border-orange-800',
    'qa-agent': 'bg-green-950 border-green-800',
    'wiki-agent': 'bg-purple-950 border-purple-800',
    'Explore': 'bg-cyan-950 border-cyan-800',
    'Plan': 'bg-yellow-950 border-yellow-800',
    'claude-code-guide': 'bg-pink-950 border-pink-800',
    'general-purpose': 'bg-gray-900 border-gray-700',
  };
  return colors[type] || 'bg-gray-900 border-gray-700';
}

function agentTypeText(type: string): string {
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
</script>

<template>
  <div
    class="rounded-lg border px-3 py-2 cursor-pointer transition-all min-w-48 max-w-64"
    :class="[
      agentTypeBg(agent.agentType),
      selected ? 'ring-2 ring-blue-500 scale-[1.02]' : 'hover:brightness-125'
    ]"
  >
    <div class="flex items-center gap-1.5 mb-1">
      <div
        v-if="agent.status === 'running'"
        class="w-2 h-2 rounded-full bg-green-500 animate-pulse"
      />
      <div
        v-else-if="agent.status === 'completed'"
        class="w-2 h-2 rounded-full bg-gray-500"
      />
      <div v-else class="w-2 h-2 rounded-full bg-red-500" />
      <span class="text-xs font-mono font-bold" :class="agentTypeText(agent.agentType)">
        {{ agent.agentType }}
      </span>
    </div>
    <div class="text-xs text-gray-300 truncate">{{ agent.description }}</div>
    <div class="flex gap-2 mt-1 text-xs text-gray-500">
      <span v-if="agent.totalTokens">{{ (agent.totalTokens / 1000).toFixed(1) }}k</span>
      <span v-if="agent.totalToolUseCount">{{ agent.totalToolUseCount }} tools</span>
      <span v-if="agent.totalDurationMs">{{ (agent.totalDurationMs / 1000).toFixed(0) }}s</span>
    </div>
  </div>
</template>
