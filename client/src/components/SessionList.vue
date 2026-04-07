<script setup lang="ts">
import type { SessionSummary } from '../types';

defineProps<{
  sessions: SessionSummary[];
  selectedId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div class="border-b border-gray-800 overflow-y-auto" style="max-height: 40%">
    <div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-950">
      Sessions ({{ sessions.length }})
    </div>
    <div
      v-for="s in sessions"
      :key="s.id"
      @click="emit('select', s.id)"
      class="px-3 py-2 cursor-pointer border-l-2 transition-colors"
      :class="s.id === selectedId
        ? 'border-blue-500 bg-gray-800/50'
        : 'border-transparent hover:bg-gray-900'"
    >
      <div class="flex items-center gap-2">
        <div
          v-if="s.isActive"
          class="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"
        />
        <span class="text-sm text-gray-200 truncate">{{ s.slug }}</span>
        <span
          v-if="s.subagentCount > 0"
          class="ml-auto text-xs text-gray-500 shrink-0"
        >
          {{ s.subagentCount }} agents
        </span>
      </div>
      <div class="text-xs text-gray-500 mt-0.5">
        {{ formatTime(s.lastActivity) }}
      </div>
    </div>
  </div>
</template>
