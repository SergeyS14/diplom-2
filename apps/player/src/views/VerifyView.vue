<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const status = ref('Проверяем ссылку…');

onMounted(async () => {
  const token = String(route.query.token || '');
  if (!token) {
    status.value = 'Нет токена в ссылке';
    return;
  }
  try {
    await auth.verify(token);
    status.value = 'Аккаунт подтверждён';
    setTimeout(() => router.push('/me'), 800);
  } catch (err) {
    status.value = err instanceof Error ? err.message : 'Ссылка не сработала';
  }
});
</script>

<template>
  <main class="px-6 py-24 text-center">
    <h1 class="text-4xl font-black">Подтверждение</h1>
    <p class="mt-6 text-xl">{{ status }}</p>
  </main>
</template>
