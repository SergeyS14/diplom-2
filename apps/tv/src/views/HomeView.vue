<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';

const game = useGameStore();
const router = useRouter();
const password = ref('');
const code = ref('');
const busy = ref(false);

async function startShow() {
  busy.value = true;
  const ok = await game.createRoom(password.value);
  busy.value = false;
  if (ok) {
    await router.push('/show');
  }
}

async function attach() {
  busy.value = true;
  const ok = await game.joinAsTv(code.value, password.value);
  busy.value = false;
  if (ok) {
    await router.push('/show');
  }
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center px-12 text-center">
    <p class="text-lg tracking-[0.4em] text-cyan-300 uppercase">TV · большой экран</p>
    <h1 class="font-display mt-4 text-7xl font-extrabold">Квиз</h1>
    <p class="mt-6 max-w-3xl text-2xl text-white/70">
      Пароль показа запускает эфир. Код и QR крутятся на экране, игроки заходят с телефона.
    </p>

    <form class="mt-12 flex w-full max-w-xl flex-col items-center gap-4" @submit.prevent="startShow">
      <input
        v-model="password"
        type="password"
        autocomplete="current-password"
        placeholder="Пароль показа"
        class="w-full rounded-2xl border border-white/20 bg-white/5 px-6 py-4 text-center text-2xl tracking-[0.2em] outline-none focus:border-cyan-300"
      />
      <button
        class="font-display rounded-full bg-amber-400 px-16 py-6 text-3xl font-extrabold text-black shadow-[0_0_40px_rgba(251,191,36,0.35)] transition hover:scale-[1.02] disabled:opacity-50"
        :disabled="busy || !password"
      >
        Начать показ
      </button>
    </form>

    <form class="mt-16 flex items-center gap-4" @submit.prevent="attach">
      <input
        v-model="code"
        maxlength="6"
        inputmode="numeric"
        placeholder="Код, если экран уже в эфире"
        class="w-80 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-center text-2xl tracking-[0.3em] outline-none focus:border-cyan-300"
      />
      <button
        type="submit"
        class="rounded-2xl border border-white/20 px-8 py-4 text-xl font-bold hover:bg-white/10"
        :disabled="busy || !code || !password"
      >
        Подключить экран
      </button>
    </form>

    <p v-if="game.error" class="mt-8 text-xl text-red-300">{{ game.error }}</p>
  </main>
</template>
