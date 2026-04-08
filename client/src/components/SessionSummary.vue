<script setup lang="ts">
defineProps<{
  summary: string;
  loading: boolean;
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  generate: [];
}>();
</script>

<template>
  <div v-if="visible" class="absolute inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
      <!-- 헤더 -->
      <div class="px-5 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <h3 class="text-sm font-bold text-yellow-400">Session Summary</h3>
        <button @click="emit('close')" class="text-gray-500 hover:text-gray-300 text-lg">&times;</button>
      </div>

      <!-- 본문 -->
      <div class="flex-1 overflow-y-auto px-5 py-4">
        <!-- 로딩 -->
        <div v-if="loading" class="flex flex-col items-center justify-center py-12 gap-3">
          <div class="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-gray-400">Claude가 세션을 분석 중...</span>
        </div>

        <!-- 요약 없음 -->
        <div v-else-if="!summary" class="flex flex-col items-center justify-center py-12 gap-4">
          <p class="text-sm text-gray-400">세션 활동을 LLM이 분석하여 요약합니다.</p>
          <p class="text-xs text-gray-600">목표, 구현 과정, 시행착오, 결과를 정리합니다.</p>
          <button
            @click="emit('generate')"
            class="mt-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded-lg transition-colors"
          >
            요약 생성
          </button>
        </div>

        <!-- 요약 표시 -->
        <div v-else class="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
          {{ summary }}
        </div>
      </div>
    </div>
  </div>
</template>
