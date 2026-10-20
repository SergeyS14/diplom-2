<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { ACHIEVEMENTS } from '@quiz/shared';
import AvatarFace from '@quiz/ui/AvatarFace.vue';
import MedalRow from '@quiz/ui/MedalRow.vue';
import { useGameStore } from '../stores/game';
import { useAuthStore } from '../stores/auth';

const game = useGameStore();
const auth = useAuthStore();
const router = useRouter();
const menuOpen = ref(false);
const remaining = ref(0);
let ticker: number | undefined;

const { room, question, reveal, roundInfo, board, ad, over, locked, pickedOptionId, me, error } =
  storeToRefs(game);

const myReveal = computed(() => reveal.value?.players.find((p) => p.id === me.value?.id));
const newMedals = computed(() => {
  const ids = over.value?.unlocked?.[me.value?.id || ''] || [];
  return ids.map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter(Boolean);
});
const hintVisible = computed(() => {
  if (!question.value?.hint || room.value?.status !== 'question') {
    return false;
  }
  const elapsed = question.value.timeLimit - remaining.value;
  return elapsed >= question.value.timeLimit * 0.45;
});

watch(
  () => question.value?.startedAt,
  (startedAt) => {
    if (ticker) {
      window.clearInterval(ticker);
    }
    if (!question.value || !startedAt) {
      remaining.value = 0;
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      remaining.value = Math.max(0, Math.ceil(question.value!.timeLimit - elapsed));
    };
    tick();
    ticker = window.setInterval(tick, 200);
  },
);

onMounted(() => {
  if (!room.value) {
    window.location.replace('/');
  }
});

onUnmounted(() => {
  if (ticker) {
    window.clearInterval(ticker);
  }
});

async function openKeep(path: string) {
  menuOpen.value = false;
  await router.push(path);
}

async function leaveQuiz() {
  menuOpen.value = false;
  await game.leave();
  await router.push('/');
}

async function logout() {
  menuOpen.value = false;
  auth.logout();
}
</script>

<template>
  <main v-if="room" class="flex min-h-dvh flex-col px-5 py-8">
    <div class="flex items-center gap-3">
      <AvatarFace :avatar="me?.avatar" :size="56" />
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-2xl font-black">{{ me?.nickname ?? 'Игрок' }}</h1>
        <p class="text-white/70">{{ me?.score ?? 0 }} очков · {{ room.code }}</p>
        <MedalRow :medals="me?.medals" />
      </div>
      <button
        class="rounded-full bg-white/15 px-3 py-2 text-sm font-black"
        type="button"
        @click="menuOpen = true"
      >
        Меню
      </button>
    </div>

    <section v-if="room.status === 'lobby'" class="mt-10">
      <p class="text-2xl font-black">Ждём старт шоу…</p>
      <ul class="mt-6 space-y-2">
        <li v-for="player in room.players" :key="player.id" class="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
          <AvatarFace :avatar="player.avatar" :size="40" />
          <span class="text-xl font-extrabold">{{ player.nickname }}</span>
        </li>
      </ul>
    </section>

    <section v-else-if="room.status === 'round'" class="mt-16 text-center">
      <p class="uppercase tracking-widest text-yellow-300">Раунд {{ (roundInfo?.roundIndex ?? room.roundIndex) + 1 }}</p>
      <p class="mt-4 text-4xl font-black">{{ roundInfo?.title || room.roundTitle }}</p>
      <p class="mt-6 text-white/60">Смотри на ТВ</p>
    </section>

    <section v-else-if="room.status === 'question' && question" class="mt-6 flex flex-1 flex-col">
      <div class="flex items-start justify-between gap-3">
        <p class="text-white/60">{{ question.roundTitle }} · вопрос {{ question.index + 1 }} / {{ question.total }}</p>
        <p class="rounded-full bg-amber-300 px-3 py-1 text-lg font-black text-[#46178f]">{{ remaining }}</p>
      </div>
      <p class="mt-3 text-2xl font-black leading-tight">{{ question.text }}</p>
      <p
        v-if="hintVisible"
        class="mt-3 rounded-2xl bg-yellow-400/20 px-4 py-3 text-lg font-extrabold text-yellow-100"
      >
        Подсказка: {{ question.hint }}
      </p>
      <div class="mt-6 grid flex-1 grid-cols-1 gap-3">
        <button
          v-for="option in question.options"
          :key="option.id"
          class="min-h-20 rounded-3xl px-5 py-5 text-left text-2xl font-black text-white shadow-lg disabled:opacity-60"
          :style="{ background: option.color, outline: pickedOptionId === option.id ? '4px solid white' : 'none' }"
          :disabled="locked"
          @click="game.submit(option.id)"
        >
          {{ option.text }}
        </button>
      </div>
      <p v-if="locked && !reveal" class="mt-4 text-center text-xl font-extrabold">Ответ принят — ждём таймер</p>
    </section>

    <section v-else-if="room.status === 'reveal'" class="mt-12 text-center">
      <p class="text-6xl">{{ myReveal?.correct ? '✓' : '✕' }}</p>
      <p class="mt-4 text-3xl font-black">{{ myReveal?.correct ? 'Верно' : 'Мимо' }}</p>
      <p class="mt-2 text-2xl text-yellow-300">+{{ myReveal?.delta ?? 0 }} · всего {{ me?.score ?? 0 }}</p>
    </section>

    <section v-else-if="room.status === 'leaderboard'" class="mt-8">
      <p class="text-2xl font-black">{{ board?.title || 'Рейтинг' }}</p>
      <ol class="mt-4 space-y-2">
        <li
          v-for="(player, i) in (board?.players || room.players)"
          :key="player.id"
          class="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 font-extrabold"
        >
          <span class="w-6">{{ i + 1 }}</span>
          <AvatarFace :avatar="player.avatar" :size="36" />
          <span class="flex-1">{{ player.nickname }}</span>
          <span>{{ player.score }}</span>
        </li>
      </ol>
    </section>

    <section v-else-if="room.status === 'ad'" class="mt-16 text-center">
      <p class="text-sm uppercase tracking-widest text-yellow-300">Реклама</p>
      <p class="mt-4 text-3xl font-black">{{ ad?.title || 'Тут могла быть ваша реклама' }}</p>
      <div class="mx-auto mt-6 flex min-h-32 max-w-sm items-center justify-center rounded-3xl border-2 border-dashed border-white/30 bg-white/5 px-4 py-8">
        <p class="text-lg font-extrabold text-white/50">Тут могла быть ваша реклама</p>
      </div>
      <p class="mt-3 text-white/70">{{ ad?.body }}</p>
      <p class="mt-8 text-white/50">Смотри большой экран</p>
    </section>

    <section v-else-if="room.status === 'finished'" class="mt-12 text-center">
      <p class="text-5xl font-black">Конец!</p>
      <p class="mt-4 text-2xl">{{ me?.nickname }} — {{ me?.score }} очков</p>
      <div v-if="newMedals.length" class="mt-6">
        <p class="font-extrabold">Новые медали</p>
        <p class="mt-2 text-3xl">{{ newMedals.map((m) => m?.icon).join(' ') }}</p>
      </div>
      <ol class="mt-8 space-y-2 text-left">
        <li v-for="(player, i) in room.players" :key="player.id" class="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 font-extrabold">
          <span>{{ i + 1 }}.</span>
          <AvatarFace :avatar="player.avatar" :size="32" />
          <span class="flex-1">{{ player.nickname }}</span>
          <span>{{ player.score }}</span>
        </li>
      </ol>
    </section>

    <section v-else class="mt-16 text-center">
      <p class="text-2xl font-black">Смотри большой экран</p>
      <p class="mt-2 text-white/60">Следующий вопрос скоро</p>
    </section>

    <p v-if="error" class="mt-6 text-red-200">{{ error }}</p>

    <div v-if="menuOpen" class="fixed inset-0 z-40 bg-black/70 p-6" @click.self="menuOpen = false">
      <div class="mx-auto mt-16 max-w-sm rounded-[2rem] bg-[#2a1458] p-6">
        <p class="text-2xl font-black">Меню</p>
        <div class="mt-5 flex flex-col gap-3">
          <button class="rounded-2xl bg-white/15 py-3 font-black" type="button" @click="openKeep('/')">В меню</button>
          <button class="rounded-2xl bg-white/15 py-3 font-black" type="button" @click="leaveQuiz">Покинуть квиз</button>
          <template v-if="!auth.user">
            <button class="rounded-2xl bg-yellow-400 py-3 font-black text-[#46178f]" type="button" @click="openKeep('/login')">Войти</button>
            <button class="rounded-2xl bg-white/15 py-3 font-black" type="button" @click="openKeep('/register')">Создать аккаунт</button>
          </template>
          <template v-else>
            <button class="rounded-2xl bg-yellow-400 py-3 font-black text-[#46178f]" type="button" @click="openKeep('/me')">Профиль и достижения</button>
            <button class="rounded-2xl bg-white/15 py-3 font-black" type="button" @click="logout">Выйти из аккаунта</button>
          </template>
          <button class="text-sm text-white/60" type="button" @click="menuOpen = false">Закрыть</button>
        </div>
      </div>
    </div>
  </main>
</template>
