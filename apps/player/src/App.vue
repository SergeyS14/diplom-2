<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useGameStore } from './stores/game';
import { useAuthStore } from './stores/auth';

const game = useGameStore();
const auth = useAuthStore();
const route = useRoute();
const play = computed(() => Boolean(route.meta.play));
const wide = computed(() => Boolean(route.meta.wide));
</script>

<template>
  <div class="min-h-dvh" :class="wide ? 'mx-auto max-w-5xl' : play ? 'mx-auto max-w-md' : 'mx-auto max-w-lg'">
    <nav v-if="!play" class="flex flex-wrap gap-2 px-4 pt-4 text-sm font-extrabold">
      <RouterLink to="/" class="rounded-full bg-white/15 px-3 py-1">Игра</RouterLink>
      <RouterLink v-if="game.room" to="/play" class="rounded-full bg-yellow-400 px-3 py-1 text-[#46178f]">К игре</RouterLink>
      <RouterLink to="/rating" class="rounded-full bg-white/15 px-3 py-1">Рейтинг</RouterLink>
      <RouterLink v-if="auth.user" to="/me" class="rounded-full bg-white/15 px-3 py-1">Профиль</RouterLink>
      <RouterLink v-else to="/login" class="rounded-full bg-white/15 px-3 py-1">Войти</RouterLink>
      <RouterLink v-if="!auth.user" to="/register" class="rounded-full bg-white/15 px-3 py-1">Регистрация</RouterLink>
      <RouterLink v-if="auth.user?.role === 'ADMIN'" to="/studio" class="rounded-full bg-white/15 px-3 py-1">Студия</RouterLink>
      <span class="ml-auto text-xs text-white/60">{{ auth.user?.nickname || auth.user?.name || 'гость' }}</span>
    </nav>
    <RouterView />
    <p
      v-if="!game.connected"
      class="fixed right-3 top-3 z-30 rounded-full bg-red-500/80 px-3 py-1 text-xs font-extrabold"
    >
      нет связи
    </p>
  </div>
</template>
