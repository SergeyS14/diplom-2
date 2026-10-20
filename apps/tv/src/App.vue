<script setup lang="ts">
import { RouterView } from 'vue-router';
import { useGameStore } from './stores/game';

const game = useGameStore();
</script>

<template>
  <div class="relative min-h-screen">
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#1a2a6c_0%,_transparent_42%),radial-gradient(circle_at_80%_80%,_#3a1c71_0%,_transparent_40%)]"
    />
    <div class="relative z-10 min-h-screen">
      <RouterView />
    </div>
    <div
      v-if="!game.connected"
      class="absolute right-6 top-6 z-20 rounded-full bg-red-500/20 px-4 py-1 text-sm font-bold text-red-300"
    >
      нет связи
    </div>
  </div>
</template>
