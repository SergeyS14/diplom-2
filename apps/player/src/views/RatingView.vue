<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AvatarFace from '@quiz/ui/AvatarFace.vue';
import MedalRow from '@quiz/ui/MedalRow.vue';
import { api } from '../api';
import type { AvatarConfig } from '@quiz/shared';

interface Row {
  id: string;
  name: string;
  avatar: AvatarConfig;
  rating: number;
  wins: number;
  gamesPlayed: number;
  medals: string[];
}

const rows = ref<Row[]>([]);

onMounted(async () => {
  rows.value = await api<Row[]>('/leaderboard');
});
</script>

<template>
  <main class="px-6 py-8">
    <h1 class="text-4xl font-black">Рейтинг</h1>
    <p class="mt-2 text-white/60">Подтверждённые аккаунты после игр</p>
    <ol class="mt-8 space-y-3">
      <li v-for="(row, i) in rows" :key="row.id" class="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
        <span class="w-6 font-black">{{ i + 1 }}</span>
        <AvatarFace :avatar="row.avatar" :size="48" />
        <div class="flex-1">
          <p class="font-black">{{ row.name }}</p>
          <MedalRow :medals="row.medals" />
        </div>
        <div class="text-right">
          <p class="font-black text-yellow-300">{{ row.rating }}</p>
          <p class="text-xs text-white/60">{{ row.wins }}/{{ row.gamesPlayed }} побед</p>
        </div>
      </li>
    </ol>
    <p v-if="!rows.length" class="mt-10 text-white/50">Пока пусто — сыграйте с аккаунтом.</p>
  </main>
</template>
