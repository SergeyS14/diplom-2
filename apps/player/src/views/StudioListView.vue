<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

interface QuizRow {
  id: string;
  title: string;
  isPublished: boolean;
  rounds: { id: string; _count: { questions: number } }[];
}

const auth = useAuthStore();
const router = useRouter();
const quizzes = ref<QuizRow[]>([]);
const error = ref('');

onMounted(async () => {
  if (!auth.token) {
    await router.replace('/login');
    return;
  }
  await reload();
});

async function reload() {
  try {
    quizzes.value = await api<QuizRow[]>('/studio/quizzes');
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
    <p class="mt-2 text-white/60">Раунды, вопросы, реклама. Только админ.</p>
    <p v-if="error" class="mt-4 text-red-200">{{ error }}</p>
    <ul class="mt-8 space-y-3">
      <li v-for="quiz in quizzes" :key="quiz.id">
        <RouterLink :to="`/studio/${quiz.id}`" class="block rounded-2xl bg-white/10 px-4 py-4">
          <p class="text-xl font-black">{{ quiz.title }}</p>
          <p class="text-sm text-white/60">
            {{ quiz.rounds.length }} раунд(ов) ·
            {{ quiz.rounds.reduce((s, r) => s + r._count.questions, 0) }} вопросов ·
            {{ quiz.isPublished ? 'опубликован' : 'черновик' }}
          </p>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>
