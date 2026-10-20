<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { OPTION_COLORS } from '@quiz/shared';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
  color: string | null;
}
interface Question {
  id: string;
  text: string;
  hint: string;
  timeLimit: number;
  points: number;
  type: string;
  options: Option[];
}
interface Ad {
  id: string;
  title: string;
  body: string;
  mediaUrl: string;
  cta: string | null;
  durationSec: number;
}
interface Round {
  id: string;
  title: string;
  type: 'STANDARD' | 'LIGHTNING' | 'FINAL';
  showLeaderboard: boolean;
  adId: string | null;
  questions: Question[];
}
interface Quiz {
  id: string;
  title: string;
  description: string | null;
  defaultQuestionTime: number;
  isPublished: boolean;
  rounds: Round[];
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const quiz = ref<Quiz | null>(null);
const ads = ref<Ad[]>([]);
const msg = ref('');
const newAd = ref({ title: 'Спонсор', body: 'Пауза на рекламу', mediaUrl: '', cta: '', durationSec: 14 });

async function load() {
  const id = String(route.params.id);
  quiz.value = await api<Quiz>(`/studio/quizzes/${id}`);
  ads.value = await api<Ad[]>('/studio/ads');
  for (const round of quiz.value.rounds) {
    for (const q of round.questions) {
      q.hint = q.hint || '';
    }
  }
}

onMounted(async () => {
  if (!auth.token) {
    await router.replace('/login');
    return;
  }
  await load();
});

async function patchQuiz(payload: Partial<Quiz>) {
  if (!quiz.value) {
    return;
  }
  quiz.value = await api<Quiz>(`/studio/quizzes/${quiz.value.id}`, { method: 'PATCH', json: payload });
  msg.value = 'Квиз сохранён';
}

async function addRound() {
  quiz.value = await api<Quiz>(`/studio/quizzes/${quiz.value!.id}/rounds`, { method: 'POST', json: {} });
}

async function saveRound(round: Round) {
  quiz.value = await api<Quiz>(`/studio/rounds/${round.id}`, {
    method: 'PATCH',
    json: {
      title: round.title,
      type: round.type,
      showLeaderboard: round.showLeaderboard,
      adId: round.adId,
    },
  });
}

async function removeRound(id: string) {
  quiz.value = await api<Quiz>(`/studio/rounds/${id}`, { method: 'DELETE' });
}

async function addQuestion(roundId: string, type: 'SINGLE' | 'TRUE_FALSE' = 'SINGLE') {
  quiz.value = await api<Quiz>(`/studio/rounds/${roundId}/questions`, { method: 'POST', json: { type } });
}

async function moveRound(id: string, direction: 'up' | 'down') {
  quiz.value = await api<Quiz>(`/studio/rounds/${id}/move`, { method: 'POST', json: { direction } });
}

async function saveQuestion(q: Question) {
  quiz.value = await api<Quiz>(`/studio/questions/${q.id}`, {
    method: 'PATCH',
    json: {
      text: q.text,
      hint: q.hint?.trim() || null,
      timeLimit: q.timeLimit,
      points: q.points,
      type: q.type,
      options: q.options.map((o, i) => ({
        text: o.text,
        isCorrect: o.isCorrect,
        color: o.color || OPTION_COLORS[i % OPTION_COLORS.length],
      })),
    },
  });
  msg.value = 'Вопрос сохранён';
}

function setType(q: Question, type: 'SINGLE' | 'TRUE_FALSE') {
  q.type = type;
  if (type === 'TRUE_FALSE') {
    q.options = [
      { id: 'tmp-true', text: 'Правда', isCorrect: true, color: OPTION_COLORS[0] },
      { id: 'tmp-false', text: 'Ложь', isCorrect: false, color: OPTION_COLORS[1] },
    ];
    return;
  }
  while (q.options.length < 4) {
    const i = q.options.length;
    q.options.push({
      id: `tmp-${i}`,
      text: `Вариант ${i + 1}`,
      isCorrect: false,
      color: OPTION_COLORS[i % OPTION_COLORS.length],
    });
  }
}

function addOption(q: Question) {
  if (q.options.length >= 4) {
    return;
  }
  const i = q.options.length;
  q.options.push({
    id: `tmp-${Date.now()}`,
    text: `Вариант ${i + 1}`,
    isCorrect: false,
    color: OPTION_COLORS[i % OPTION_COLORS.length],
  });
}

function removeOption(q: Question, index: number) {
  if (q.options.length <= 2) {
    return;
  }
  const wasCorrect = q.options[index]?.isCorrect;
  q.options.splice(index, 1);
  if (wasCorrect && q.options[0]) {
    q.options[0].isCorrect = true;
  }
}

async function removeQuestion(id: string) {
  quiz.value = await api<Quiz>(`/studio/questions/${id}`, { method: 'DELETE' });
}

async function createAd() {
  await api('/studio/ads', { method: 'POST', json: newAd.value });
  ads.value = await api<Ad[]>('/studio/ads');
  msg.value = 'Реклама добавлена';
}
</script>

<template>
  <main v-if="quiz" class="px-4 py-8 md:px-6">
    <button class="text-sm underline" @click="router.push('/studio')">← к списку</button>
    <div class="mt-4 grid gap-3">
      <input v-model="quiz.title" class="rounded-2xl bg-white/15 px-4 py-3 text-2xl font-black outline-none" />
      <textarea v-model="quiz.description" class="rounded-2xl bg-white/15 px-4 py-3 outline-none" rows="2" />
      <label class="text-sm">Секунд на вопрос по умолчанию
        <input v-model.number="quiz.defaultQuestionTime" type="number" class="ml-2 w-20 rounded bg-white/15 px-2 py-1" />
      </label>
      <div class="flex flex-wrap gap-2">
        <button class="rounded-full bg-white/15 px-4 py-2 font-black" @click="patchQuiz({ title: quiz.title, description: quiz.description, defaultQuestionTime: quiz.defaultQuestionTime })">
          Сохранить карточку
        </button>
        <button
          class="rounded-full px-4 py-2 font-black"
          :class="quiz.isPublished ? 'bg-white/15' : 'bg-yellow-400 text-[#46178f]'"
          @click="patchQuiz({ isPublished: !quiz.isPublished })"
        >
          {{ quiz.isPublished ? 'Снять с эфира' : 'Опубликовать' }}
        </button>
      </div>
    </div>
    <p v-if="msg" class="mt-3 text-yellow-200">{{ msg }}</p>

    <h2 class="mt-10 text-2xl font-black">Реклама</h2>
    <div class="mt-3 grid gap-2 md:grid-cols-2">
      <input v-model="newAd.title" class="rounded-xl bg-white/15 px-3 py-2" placeholder="Заголовок" />
      <input v-model.number="newAd.durationSec" type="number" class="rounded-xl bg-white/15 px-3 py-2" placeholder="Секунд" />
      <input v-model="newAd.body" class="rounded-xl bg-white/15 px-3 py-2 md:col-span-2" placeholder="Текст карточки" />
      <input v-model="newAd.mediaUrl" class="rounded-xl bg-white/15 px-3 py-2" placeholder="URL картинки или ролика" />
      <input v-model="newAd.cta" class="rounded-xl bg-white/15 px-3 py-2" placeholder="Кнопка CTA" />
    </div>
    <button class="mt-2 rounded-xl bg-white/20 px-4 py-2 font-black" @click="createAd">Добавить рекламу</button>
    <p v-if="ads.length" class="mt-3 text-sm text-white/60">В библиотеке: {{ ads.map((a) => a.title).join(', ') }}</p>

    <div class="mt-8 flex items-center justify-between">
      <h2 class="text-2xl font-black">Раунды</h2>
      <button class="rounded-full bg-yellow-400 px-4 py-2 font-black text-[#46178f]" @click="addRound">Добавить раунд</button>
    </div>

    <section v-for="round in quiz.rounds" :key="round.id" class="mt-6 rounded-3xl bg-white/10 p-4">
      <div class="flex flex-wrap gap-2">
        <input v-model="round.title" class="flex-1 rounded-xl bg-black/20 px-3 py-2 font-black outline-none" />
        <select v-model="round.type" class="rounded-xl bg-black/30 px-3 py-2">
          <option value="STANDARD">Обычный</option>
          <option value="LIGHTNING">Блиц</option>
          <option value="FINAL">Финал</option>
        </select>
      </div>
      <label class="mt-3 flex items-center gap-2 text-sm">
        <input v-model="round.showLeaderboard" type="checkbox" />
        Рейтинг после раунда
      </label>
      <label class="mt-2 block text-sm">
        Реклама после раунда
        <select v-model="round.adId" class="ml-2 rounded bg-black/30 px-2 py-1">
          <option :value="null">нет</option>
          <option v-for="ad in ads" :key="ad.id" :value="ad.id">{{ ad.title }}</option>
        </select>
      </label>
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="rounded-full bg-white/20 px-3 py-1 text-sm font-black" @click="saveRound(round)">Сохранить раунд</button>
        <button class="rounded-full bg-white/20 px-3 py-1 text-sm" @click="moveRound(round.id, 'up')">↑</button>
        <button class="rounded-full bg-white/20 px-3 py-1 text-sm" @click="moveRound(round.id, 'down')">↓</button>
        <button class="rounded-full bg-red-500/40 px-3 py-1 text-sm" @click="removeRound(round.id)">Удалить</button>
        <button class="rounded-full bg-yellow-400 px-3 py-1 text-sm font-black text-[#46178f]" @click="addQuestion(round.id, 'SINGLE')">+ вопрос</button>
        <button class="rounded-full bg-yellow-400/80 px-3 py-1 text-sm font-black text-[#46178f]" @click="addQuestion(round.id, 'TRUE_FALSE')">+ правда/ложь</button>
      </div>

      <article v-for="q in round.questions" :key="q.id" class="mt-4 rounded-2xl bg-black/20 p-3">
        <textarea v-model="q.text" class="w-full rounded-xl bg-white/10 px-3 py-2 outline-none" rows="2" />
        <input
          :value="q.hint || ''"
          class="mt-2 w-full rounded-xl bg-white/10 px-3 py-2 text-sm outline-none"
          placeholder="Подсказка (выйдет в середине таймера)"
          @input="q.hint = ($event.target as HTMLInputElement).value"
        />
        <div class="mt-2 flex flex-wrap gap-3 text-sm">
          <label>сек <input v-model.number="q.timeLimit" type="number" class="w-16 rounded bg-white/10 px-2" /></label>
          <label>баллы <input v-model.number="q.points" type="number" class="w-20 rounded bg-white/10 px-2" /></label>
          <select :value="q.type" class="rounded bg-black/40 px-2 py-1" @change="setType(q, ($event.target as HTMLSelectElement).value as 'SINGLE' | 'TRUE_FALSE')">
            <option value="SINGLE">Один верный</option>
            <option value="TRUE_FALSE">Правда / ложь</option>
          </select>
        </div>
        <div class="mt-3 space-y-2">
          <label v-for="(opt, index) in q.options" :key="opt.id" class="flex items-center gap-2">
            <input type="radio" :name="`c-${q.id}`" :checked="opt.isCorrect" @change="q.options.forEach((o) => (o.isCorrect = o.id === opt.id))" />
            <input v-model="opt.text" class="flex-1 rounded-lg bg-white/10 px-2 py-1 outline-none" />
            <button v-if="q.type !== 'TRUE_FALSE'" class="text-xs text-white/50" type="button" @click="removeOption(q, index)">×</button>
          </label>
        </div>
        <button v-if="q.type !== 'TRUE_FALSE' && q.options.length < 4" class="mt-2 text-sm underline" type="button" @click="addOption(q)">+ вариант</button>
        <div class="mt-3 flex gap-2">
          <button class="rounded-full bg-yellow-400 px-3 py-1 text-sm font-black text-[#46178f]" @click="saveQuestion(q)">Сохранить вопрос</button>
          <button class="text-sm underline" @click="removeQuestion(q.id)">удалить</button>
        </div>
      </article>
    </section>
  </main>
</template>
