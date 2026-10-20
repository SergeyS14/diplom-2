<script setup lang="ts">
import { ACHIEVEMENTS } from '@quiz/shared';

defineProps<{ medals?: string[]; size?: 'sm' | 'md' }>();
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <span
      v-for="id in medals?.slice(0, 4)"
      :key="id"
      class="inline-flex items-center rounded-full bg-black/20 px-1.5 py-0.5 text-[11px] leading-none"
      :title="ACHIEVEMENTS.find((a) => a.id === id)?.title"
    >
      {{ ACHIEVEMENTS.find((a) => a.id === id)?.icon || '🏅' }}
    </span>
  </div>
</template>
