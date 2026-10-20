<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    await auth.login({ email: email.value, password: password.value });
    const next = typeof route.query.next === 'string' ? route.query.next : '/me';
    await router.push(next);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка входа';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="px-6 py-12">
    <h1 class="text-4xl font-black">Вход</h1>
    <p class="mt-2 text-white/70">Демо: player@quiz.local / diplom123</p>
    <form class="mt-8 flex flex-col gap-3" @submit.prevent="submit">
      <input v-model="email" type="email" placeholder="Email" class="rounded-2xl bg-white/15 px-4 py-3 outline-none" />
      <input v-model="password" type="password" placeholder="Пароль" class="rounded-2xl bg-white/15 px-4 py-3 outline-none" />
      <button class="rounded-2xl bg-yellow-400 py-3 font-black text-[#46178f]" :disabled="busy">Войти</button>
    </form>
    <p v-if="error" class="mt-4 text-red-200">{{ error }}</p>
    <RouterLink to="/register" class="mt-6 inline-block underline">Нет аккаунта</RouterLink>
  </main>
</template>
