<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { useAuthStore } from '../stores/auth';

const game = useGameStore();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const code = ref('');
const nickname = ref('');
const busy = ref(false);

onMounted(() => {
  const fromRoute = String(route.params.code || '');
  if (fromRoute) {
    code.value = fromRoute.replace(/\D/g, '').slice(0, 6);
  }
  nickname.value = auth.user?.nickname || auth.user?.name || '';
});

watch(
  () => auth.user,
  (user) => {
    if (user && !nickname.value) {
      nickname.value = user.nickname || user.name;
    }
  },
);

async function enter() {
  busy.value = true;
  const ok = await game.join(code.value, nickname.value);
  busy.value = false;
  if (ok) {
    await router.push('/play');
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col justify-center px-6 py-16">
    <p class="text-sm font-extrabold uppercase tracking-[0.3em] text-yellow-300">PWA игрока</p>
    <h1 class="mt-3 text-5xl font-black leading-tight">Играй с телефона</h1>
    <p class="mt-3 text-lg text-white/70">Сканируй QR на ТВ или введи код. Аккаунт всегда игровой — рейтинг копится после подтверждения почты и финала шоу.</p>

    <div v-if="game.room" class="mt-8 rounded-2xl bg-yellow-400 px-5 py-4 text-center text-[#46178f]">
      <p class="font-black">Ты в игре {{ game.room.code }}</p>
      <button class="mt-2 text-sm font-extrabold underline" type="button" @click="router.push('/play')">Вернуться к вопросам</button>
    </div>

    <form class="mt-10 flex flex-col gap-4" @submit.prevent="enter">
      <input
        v-model="code"
        maxlength="6"
        inputmode="numeric"
        placeholder="Код"
        class="rounded-2xl bg-white px-5 py-4 text-center text-4xl font-black tracking-[0.4em] text-[#46178f] outline-none"
      />
      <input
        v-model="nickname"
        maxlength="20"
        placeholder="Твой ник"
        class="rounded-2xl bg-white/15 px-5 py-4 text-center text-2xl font-extrabold outline-none placeholder:text-white/40"
      />
      <button
        type="submit"
        class="rounded-2xl bg-yellow-400 py-4 text-2xl font-black text-[#46178f] disabled:opacity-50"
        :disabled="busy"
      >
        Войти в игру
      </button>
    </form>
    <p v-if="game.error" class="mt-6 text-center text-red-200">{{ game.error }}</p>
    <div class="mt-10 flex flex-wrap justify-center gap-4 text-sm font-extrabold">
      <RouterLink v-if="!auth.user" to="/login" class="underline">Войти в аккаунт</RouterLink>
      <RouterLink v-if="!auth.user" to="/register" class="underline">Создать аккаунт</RouterLink>
      <template v-else>
        <RouterLink to="/me" class="underline">{{ auth.user.nickname || auth.user.name }} · профиль</RouterLink>
        <button class="underline" type="button" @click="auth.logout()">Выйти</button>
      </template>
      <RouterLink to="/rating" class="underline">Рейтинг</RouterLink>
    </div>
  </main>
</template>
