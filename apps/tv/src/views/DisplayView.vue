<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import AvatarFace from '@quiz/ui/AvatarFace.vue';
import MedalRow from '@quiz/ui/MedalRow.vue';
import { useGameStore } from '../stores/game';

const game = useGameStore();
const router = useRouter();
const { room, question, reveal, accepted, podium, error, roundInfo, board, ad } = storeToRefs(game);
const qr = ref('');

const playerUrl = computed(() => {
  const base = import.meta.env.VITE_PLAYER_URL || 'http://localhost:5174';
  const code = room.value?.code ?? '';
  return `${base}/join/${code}`;
});

watch(
  playerUrl,
  async (url) => {
    if (!room.value?.code) {
      qr.value = '';
      return;
    }
    qr.value = await QRCode.toDataURL(url, { width: 420, margin: 1, color: { dark: '#070b16', light: '#ffffff' } });
  },
  { immediate: true },
);

const remaining = ref(0);
const hintVisible = computed(() => {
  if (!question.value?.hint || room.value?.status !== 'question') {
    return false;
  }
  const elapsed = question.value.timeLimit - remaining.value;
  return elapsed >= question.value.timeLimit * 0.45;
});
let ticker: number | undefined;

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

async function backToMenu() {
  await game.leave();
  await router.push('/');
}
</script>

<template>
  <main v-if="room" class="flex min-h-screen flex-col px-12 py-10">
    <header class="flex items-start justify-between gap-8 pr-40">
      <div>
        <p class="text-cyan-300 uppercase tracking-[0.3em]">{{ room.quizTitle }}</p>
        <h1 class="font-display mt-2 text-5xl">
          <template v-if="room.status === 'lobby'">Лобби</template>
          <template v-else-if="room.status === 'round'">{{ roundInfo?.title || room.roundTitle }}</template>
          <template v-else-if="room.status === 'question'">{{ question?.roundTitle }} · {{ (question?.index ?? 0) + 1 }}/{{ room.totalQuestions }}</template>
          <template v-else-if="room.status === 'reveal'">Результаты</template>
          <template v-else-if="room.status === 'leaderboard'">Рейтинг</template>
          <template v-else-if="room.status === 'ad'">Реклама</template>
          <template v-else-if="room.status === 'finished'">Финал</template>
          <template v-else>Эфир</template>
        </h1>
        <button class="mt-3 text-sm font-bold text-white/50 underline" type="button" @click="backToMenu">
          В меню
        </button>
      </div>
      <div v-if="room.status === 'lobby'" class="text-right">
        <p class="text-white/50">Код комнаты</p>
        <p class="font-display animate-pulse text-7xl tracking-[0.2em] text-amber-300">{{ room.code }}</p>
      </div>
    </header>

    <section v-if="room.status === 'lobby'" class="mt-10 grid flex-1 grid-cols-[1.2fr_0.8fr] gap-12">
      <div>
        <p class="text-2xl text-white/60">Игроки подключаются с телефона</p>
        <div class="mt-8 flex flex-wrap gap-4">
          <div
            v-for="player in room.players"
            :key="player.id"
            class="flex items-center gap-3 rounded-3xl bg-white/10 px-5 py-4"
            :class="player.connected ? 'text-white' : 'text-white/40'"
          >
            <AvatarFace :avatar="player.avatar" :size="64" />
            <div>
              <p class="text-2xl font-extrabold">{{ player.nickname }}</p>
              <MedalRow :medals="player.medals" />
            </div>
          </div>
          <div v-if="room.players.length === 0" class="text-3xl text-white/40">Пока никого…</div>
        </div>
        <p class="mt-14 text-xl text-white/50">Шоу само начнётся через несколько секунд после первого игрока</p>
        <p v-if="error" class="mt-6 text-xl text-red-300">{{ error }}</p>
      </div>
      <div class="flex flex-col items-center justify-center rounded-[2.5rem] bg-white p-8 text-[#070b16]">
        <img v-if="qr" :src="qr" alt="QR для входа" class="h-72 w-72" />
        <p class="mt-4 text-xl font-bold">Наведите камеру или откройте</p>
        <p class="mt-1 text-lg text-black/60">{{ playerUrl }}</p>
      </div>
    </section>

    <section v-else-if="room.status === 'round'" class="flex flex-1 flex-col items-center justify-center text-center">
      <p class="text-2xl uppercase tracking-[0.4em] text-cyan-300">Раунд {{ (roundInfo?.roundIndex ?? 0) + 1 }} / {{ roundInfo?.totalRounds || room.totalRounds }}</p>
      <h2 class="font-display mt-6 text-8xl">{{ roundInfo?.title || room.roundTitle }}</h2>
    </section>

    <section v-else-if="room.status === 'question' && question" class="mt-8 flex flex-1 flex-col">
      <div class="flex items-center justify-between">
        <h2 class="font-display max-w-5xl text-5xl leading-tight">{{ question.text }}</h2>
        <div class="flex h-32 w-32 items-center justify-center rounded-full border-8 border-amber-300 text-5xl font-extrabold">
          {{ remaining }}
        </div>
      </div>
      <p
        v-if="hintVisible"
        class="mt-6 max-w-4xl rounded-[1.5rem] bg-amber-300/15 px-6 py-4 text-3xl font-extrabold text-amber-200"
      >
        Подсказка: {{ question.hint }}
      </p>
      <div class="mt-10 grid grid-cols-2 gap-6">
        <div
          v-for="option in question.options"
          :key="option.id"
          class="rounded-[2rem] px-8 py-10 text-4xl font-extrabold text-white shadow-xl"
          :style="{ background: option.color }"
        >
          {{ option.text }}
        </div>
      </div>
      <p class="mt-8 text-2xl text-white/50">
        Ответили {{ accepted?.answeredCount ?? 0 }} / {{ accepted?.totalPlayers ?? room.players.filter((p) => p.connected).length }}
      </p>
    </section>

    <section v-else-if="room.status === 'reveal' && question && reveal" class="mt-8 flex flex-1 flex-col">
      <h2 class="font-display text-4xl">{{ question.text }}</h2>
      <div class="mt-8 grid grid-cols-2 gap-6">
        <div
          v-for="option in question.options"
          :key="option.id"
          class="rounded-[2rem] px-8 py-10 text-3xl font-extrabold text-white"
          :style="{ background: option.color, opacity: reveal.correctOptionIds.includes(option.id) ? 1 : 0.45 }"
        >
          <p>{{ option.text }}</p>
          <p class="mt-3 text-xl font-bold">
            {{ reveal.stats.find((s) => s.optionId === option.id)?.count ?? 0 }} чел.
            <span v-if="reveal.correctOptionIds.includes(option.id)"> · верно</span>
          </p>
        </div>
      </div>
      <div class="mt-10 grid grid-cols-3 gap-4">
        <div v-for="(player, i) in reveal.players.slice(0, 6)" :key="player.id" class="flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-4">
          <AvatarFace :avatar="player.avatar" :size="56" />
          <div>
            <p class="text-white/50">{{ i + 1 }} место</p>
            <p class="text-2xl font-extrabold">{{ player.nickname }}</p>
            <p class="text-amber-300">{{ player.score }} <span class="text-white/50">(+{{ player.delta }})</span></p>
          </div>
        </div>
      </div>
    </section>

    <section v-else-if="room.status === 'leaderboard'" class="mt-8 flex flex-1 flex-col">
      <h2 class="font-display text-5xl">{{ board?.title || 'Рейтинг' }}</h2>
      <div class="mt-10 space-y-4">
        <div
          v-for="(player, i) in (board?.players || room.players)"
          :key="player.id"
          class="flex items-center gap-6 rounded-[2rem] bg-white/10 px-8 py-5"
        >
          <span class="font-display w-16 text-4xl">{{ i + 1 }}</span>
          <AvatarFace :avatar="player.avatar" :size="72" />
          <div class="flex-1">
            <p class="text-3xl font-extrabold">{{ player.nickname }}</p>
            <MedalRow :medals="player.medals" />
          </div>
          <p class="font-display text-4xl text-amber-300">{{ player.score }}</p>
        </div>
      </div>
    </section>

    <section v-else-if="room.status === 'ad'" class="flex flex-1 flex-col items-center justify-center text-center">
      <p class="uppercase tracking-[0.5em] text-amber-300">Реклама</p>
      <h2 class="font-display mt-6 text-7xl">{{ ad?.title || 'Тут могла быть ваша реклама' }}</h2>
      <img v-if="ad?.mediaUrl" :src="ad.mediaUrl" alt="" class="mt-8 max-h-72 rounded-3xl object-contain" />
      <div
        v-else
        class="mt-8 flex h-72 w-full max-w-4xl items-center justify-center rounded-[2.5rem] border-4 border-dashed border-white/25 bg-white/5"
      >
        <p class="font-display px-8 text-5xl text-white/35">Тут могла быть ваша реклама</p>
      </div>
      <p class="mt-6 max-w-4xl text-3xl text-white/70">{{ ad?.body }}</p>
      <p v-if="ad?.cta" class="mt-10 rounded-full bg-white px-10 py-4 text-2xl font-black text-black">{{ ad.cta }}</p>
    </section>

    <section v-else-if="room.status === 'finished'" class="mt-16 flex flex-1 flex-col items-center">
      <p class="text-cyan-300 uppercase tracking-[0.4em]">Подиум</p>
      <div class="mt-12 flex items-end gap-8">
        <div
          v-for="(player, i) in (podium?.players ?? room.players).slice(0, 3)"
          :key="player.id"
          class="rounded-[2rem] px-10 py-8 text-center"
          :class="i === 0 ? 'order-2 min-h-64 min-w-72 bg-amber-400 text-black' : i === 1 ? 'order-1 min-w-56 bg-white/10' : 'order-3 min-w-56 bg-white/10'"
        >
          <AvatarFace class="mx-auto" :avatar="player.avatar" :size="i === 0 ? 120 : 88" />
          <p class="mt-3 text-4xl">{{ ['🥇', '🥈', '🥉'][i] }}</p>
          <p class="font-display mt-2 text-4xl">{{ player.nickname }}</p>
          <MedalRow class="mt-2 justify-center" :medals="player.medals" />
          <p class="mt-2 text-2xl font-bold">{{ player.score }}</p>
        </div>
      </div>
    </section>

    <aside
      v-if="room.status !== 'lobby'"
      class="fixed bottom-6 right-6 z-20 flex items-center gap-4 rounded-[2rem] bg-black/70 px-5 py-4 shadow-2xl backdrop-blur"
    >
      <img v-if="qr" :src="qr" alt="QR" class="h-28 w-28 rounded-2xl bg-white p-1" />
      <div>
        <p class="text-sm uppercase tracking-[0.2em] text-white/50">Заходи в игру</p>
        <p class="font-display mt-1 animate-pulse text-5xl tracking-[0.18em] text-amber-300">{{ room.code }}</p>
      </div>
    </aside>
  </main>
</template>
