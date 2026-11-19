<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

interface QuizRow {
  id: string;
  title: string;
  broadcastOrder: number;
  createdAt: string;
  isPublished: boolean;
  rounds: { id: string; _count: { questions: number } }[];
}

interface Broadcast {
  code: string;
  title: string;
  status: string;
  players: number;
}

const stages: Record<string, string> = {
  lobby: 'Лобби',
  playing: 'Старт',
  round: 'Раунд',
  question: 'Вопрос',
  reveal: 'Ответ',
  leaderboard: 'Рейтинг',
  ad: 'Реклама',
  finished: 'Подиум',
};

const auth = useAuthStore();
const router = useRouter();
const broadcasts = ref<Broadcast[]>([]);
const quizzes = ref<QuizRow[]>([]);
const error = ref('');
let polling: number;

async function refreshBroadcasts() {
  try {
    broadcasts.value = await api<Broadcast[]>('/studio/broadcasts');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка загрузки эфира';
  }
}
onUnmounted(() => window.clearInterval(polling));

onMounted(async () => {
  if (!auth.token) {
    await router.replace({ path: '/login', query: { next: router.currentRoute.value.fullPath } });
    return;
  }
  polling = window.setInterval(refreshBroadcasts, 5000);
  await Promise.all([reload(), refreshBroadcasts()]);
});

async function reload() {
  try {
    const rows = await api<QuizRow[]>('/studio/quizzes');
    quizzes.value = rows.sort((a, b) =>
      Number(b.isPublished) - Number(a.isPublished)
      || a.broadcastOrder - b.broadcastOrder
      || a.createdAt.localeCompare(b.createdAt)
      || a.id.localeCompare(b.id),
    );
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Нет доступа';
  }
}

async function create() {
  const quiz = await api<{ id: string }>('/studio/quizzes', {
    method: 'POST',
    json: { title: 'Новый квиз' },
  });
  await router.push(`/studio/${quiz.id}`);
}
</script>

<template>
  <main class="px-6 py-8">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-4xl font-black">Студия</h1>
      <button class="rounded-full bg-yellow-400 px-4 py-2 font-black text-[#46178f]" @click="create">Новый квиз</button>
    </div>
    <p class="mt-2 text-white/60">Опубликованные квизы идут по кругу в порядке позиции. Изменения вступают в силу со следующей игры.</p>
    <p v-if="error" class="mt-4 text-red-200">{{ error }}</p>
    <section class="mt-6 rounded-2xl bg-black/20 p-5">
      <h2 class="text-xl font-black">Сейчас в эфире</h2>
      <p v-if="!broadcasts.length" class="mt-2 text-white/70">Активных показов пока нет.</p>
      <div v-for="show in broadcasts" :key="show.code" class="mt-3">
        <strong>{{ show.title }}</strong> · {{ stages[show.status] }} · игроков {{ show.players }}
        <span class="ml-2 font-mono">{{ show.code }}</span>
      </div>
    </section>
    <h2 class="mt-8 text-xl font-black">Очередь квизов</h2>
    <ul class="mt-3 space-y-3">
      <li v-for="quiz in quizzes" :key="quiz.id">
        <RouterLink :to="`/studio/${quiz.id}`" class="block rounded-2xl bg-white/10 px-4 py-4">
          <p class="text-xl font-black">{{ quiz.title }}</p>
          <p class="text-sm text-white/60">
            {{ quiz.rounds.length }} раунд(ов) ·
            {{ quiz.rounds.reduce((s, r) => s + r._count.questions, 0) }} вопросов ·
            {{ quiz.isPublished ? 'позиция ' + quiz.broadcastOrder : 'черновик' }}
          </p>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>
