<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import type { StoryEvent, SessionDetail } from '../types';
import StoryEventComponent from './StoryEvent.vue';

const props = defineProps<{
  events: StoryEvent[];
  session: SessionDetail;
}>();

const container = ref<HTMLElement | null>(null);

watch(
  () => props.events.length,
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
    <div class="px-4 py-2 border-b border-gray-800 bg-yellow-950/20 shrink-0 flex items-center gap-2">
      <span class="text-xs font-mono font-bold text-yellow-400">Main Session</span>
      <span class="text-xs text-gray-400">{{ session.slug }}</span>
      <span class="ml-auto text-xs text-gray-600">{{ events.length }} events</span>
    </div>
    <div ref="container" class="flex-1 overflow-y-auto px-4 py-2 space-y-1">
      <StoryEventComponent
        v-for="event in events"
        :key="event.uuid"
        :event="event"
      />
    </div>
  </div>
</template>
