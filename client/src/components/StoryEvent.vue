<script setup lang="ts">
import { ref } from 'vue';
import type { StoryEvent } from '../types';

const props = defineProps<{
  event: StoryEvent;
  isSubAgent?: boolean;
}>();

const expanded = ref(false);

function formatTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function toolIcon(name: string): string {
  const icons: Record<string, string> = {
    Read: '📖',
    Write: '✏️',
    Edit: '🔧',
    Bash: '💻',
    Glob: '🔍',
    Grep: '🔎',
    Agent: '🤖',
    WebFetch: '🌐',
    WebSearch: '🔍',
    Skill: '⚡',
  };
  return icons[name] || '🔧';
}

function formatToolInput(input: Record<string, any>): string {
  if (!input) return '';
  const parts: string[] = [];
  for (const [key, val] of Object.entries(input)) {
    if (typeof val === 'string') {
      parts.push(`${key}: ${val}`);
    } else if (typeof val === 'number') {
      parts.push(`${key}: ${val}`);
    }
  }
  return parts.join(' | ');
}

function truncateResult(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length <= 3) return text;
  return lines.slice(0, 3).join('\n');
}
</script>

<template>
  <!-- Thought (assistant 텍스트) -->
  <div v-if="event.type === 'thought'" class="flex gap-2 py-1.5">
    <span class="text-xs text-gray-600 shrink-0 w-16 text-right font-mono">
      {{ formatTime(event.timestamp) }}
    </span>
    <div class="flex-1 rounded bg-blue-950/30 border border-blue-900/30 px-3 py-1.5">
      <div class="text-xs text-blue-300 whitespace-pre-wrap">{{ event.text }}</div>
    </div>
  </div>

  <!-- Tool Use -->
  <div v-else-if="event.type === 'tool_use'" class="flex gap-2 py-1">
    <span class="text-xs text-gray-600 shrink-0 w-16 text-right font-mono">
      {{ formatTime(event.timestamp) }}
    </span>
    <div class="flex-1 rounded bg-orange-950/20 border border-orange-900/20 px-3 py-1.5">
      <div class="flex items-center gap-1.5">
        <span>{{ toolIcon(event.toolName || '') }}</span>
        <span class="text-xs font-mono font-bold text-orange-400">
          {{ event.toolName }}
        </span>
        <span class="text-xs text-gray-500 truncate">
          {{ formatToolInput(event.toolInput || {}) }}
        </span>
      </div>
    </div>
  </div>

  <!-- Tool Result -->
  <div v-else-if="event.type === 'tool_result'" class="flex gap-2 py-0.5">
    <span class="text-xs text-gray-600 shrink-0 w-16" />
    <div
      class="flex-1 rounded px-3 py-1 cursor-pointer"
      :class="event.isError
        ? 'bg-red-950/20 border border-red-900/30'
        : 'bg-gray-900/50 border border-gray-800/50'"
      @click="expanded = !expanded"
    >
      <div class="flex items-center gap-1">
        <span class="text-xs text-gray-600">{{ expanded ? '▼' : '▶' }}</span>
        <span class="text-xs text-gray-500">
          {{ event.isError ? '❌ Error' : 'Result' }}
          ({{ (event.content || '').length }} chars)
        </span>
      </div>
      <pre
        v-if="expanded"
        class="text-xs text-gray-400 mt-1 whitespace-pre-wrap break-all max-h-64 overflow-y-auto"
      >{{ event.content }}</pre>
      <pre
        v-else-if="event.content"
        class="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap truncate"
      >{{ truncateResult(event.content || '') }}</pre>
    </div>
  </div>

  <!-- System -->
  <div v-else-if="event.type === 'system'" class="flex gap-2 py-0.5">
    <span class="text-xs text-gray-600 shrink-0 w-16 text-right font-mono">
      {{ formatTime(event.timestamp) }}
    </span>
    <div class="flex-1 text-xs text-gray-600 italic">
      [system] {{ event.text }}
    </div>
  </div>

  <!-- Thinking (Extended Thinking) -->
  <div v-else-if="event.type === 'thinking'" class="flex gap-2 py-1.5">
    <span class="text-xs text-gray-600 shrink-0 w-16 text-right font-mono">
      {{ formatTime(event.timestamp) }}
    </span>
    <div
      class="flex-1 rounded bg-purple-950/30 border border-purple-900/30 px-3 py-1.5 cursor-pointer"
      @click="expanded = !expanded"
    >
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-purple-400 font-bold">Thinking</span>
        <span class="text-xs text-gray-500">
          ({{ (event.thinkingText || '').length }} chars)
        </span>
        <span class="text-xs text-gray-600 ml-auto">{{ expanded ? '▼' : '▶' }}</span>
      </div>
      <div v-if="expanded" class="text-xs text-purple-300 mt-1.5 whitespace-pre-wrap max-h-96 overflow-y-auto">
        {{ event.thinkingText }}
      </div>
      <div v-else class="text-xs text-purple-400/60 mt-0.5 truncate">
        {{ (event.thinkingText || '').substring(0, 100) }}{{ (event.thinkingText || '').length > 100 ? '...' : '' }}
      </div>
    </div>
  </div>

  <!-- User Message / Prompt -->
  <div v-else-if="event.type === 'user_message'" class="flex gap-2 py-1.5">
    <span class="text-xs text-gray-600 shrink-0 w-16 text-right font-mono">
      {{ formatTime(event.timestamp) }}
    </span>
    <div class="flex-1 rounded px-3 py-1.5"
      :class="isSubAgent
        ? 'bg-cyan-950/30 border border-cyan-900/30'
        : 'bg-green-950/30 border border-green-900/30'"
    >
      <div class="flex items-center gap-1.5 mb-0.5">
        <span class="text-xs font-bold" :class="isSubAgent ? 'text-cyan-400' : 'text-green-400'">
          {{ isSubAgent ? 'Prompt' : 'You' }}
        </span>
      </div>
      <div class="text-xs whitespace-pre-wrap" :class="isSubAgent ? 'text-cyan-300' : 'text-green-300'">{{ event.text }}</div>
    </div>
  </div>

  <!-- Response (서브에이전트 최종 응답) -->
  <div v-else-if="event.type === 'response'" class="flex gap-2 py-1.5">
    <span class="text-xs text-gray-600 shrink-0 w-16 text-right font-mono">
      {{ formatTime(event.timestamp) }}
    </span>
    <div
      class="flex-1 rounded bg-emerald-950/30 border border-emerald-900/30 px-3 py-1.5 cursor-pointer"
      @click="expanded = !expanded"
    >
      <div class="flex items-center gap-1.5 mb-0.5">
        <span class="text-xs font-bold text-emerald-400">Response</span>
        <span class="text-xs text-gray-500">
          ({{ (event.text || '').length }} chars)
        </span>
        <span class="text-xs text-gray-600 ml-auto">{{ expanded ? '▼' : '▶' }}</span>
      </div>
      <div v-if="expanded" class="text-xs text-emerald-300 whitespace-pre-wrap max-h-96 overflow-y-auto">
        {{ event.text }}
      </div>
      <div v-else class="text-xs text-emerald-400/60 mt-0.5 truncate">
        {{ (event.text || '').substring(0, 150) }}{{ (event.text || '').length > 150 ? '...' : '' }}
      </div>
    </div>
  </div>

  <!-- Agent Spawn -->
  <div v-else-if="event.type === 'agent_spawn'" class="flex gap-2 py-1">
    <span class="text-xs text-gray-600 shrink-0 w-16 text-right font-mono">
      {{ formatTime(event.timestamp) }}
    </span>
    <div class="flex-1 rounded bg-amber-950/20 border border-amber-900/20 px-3 py-1.5">
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-mono font-bold text-amber-400">
          Agent
        </span>
        <span class="text-xs text-amber-300">
          Spawned {{ event.agentType || event.toolInput?.subagent_type || '' }}
        </span>
      </div>
      <div v-if="event.toolInput?.description" class="text-xs text-gray-400 mt-0.5">
        {{ event.toolInput.description }}
      </div>
    </div>
  </div>

  <!-- Agent Result -->
  <div v-else-if="event.type === 'agent_result'" class="flex gap-2 py-0.5">
    <span class="text-xs text-gray-600 shrink-0 w-16 text-right font-mono">
      {{ formatTime(event.timestamp) }}
    </span>
    <div
      class="flex-1 rounded bg-teal-950/20 border border-teal-900/20 px-3 py-1 cursor-pointer"
      @click="expanded = !expanded"
    >
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-gray-600">{{ expanded ? '▼' : '▶' }}</span>
        <span class="text-xs font-bold text-teal-400">
          Agent {{ event.agentType }} completed
        </span>
        <span class="text-xs text-gray-500">
          ({{ (event.content || '').length }} chars)
        </span>
      </div>
      <pre
        v-if="expanded"
        class="text-xs text-gray-400 mt-1 whitespace-pre-wrap break-all max-h-64 overflow-y-auto"
      >{{ event.content }}</pre>
      <pre
        v-else-if="event.content"
        class="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap truncate"
      >{{ truncateResult(event.content || '') }}</pre>
    </div>
  </div>
</template>
