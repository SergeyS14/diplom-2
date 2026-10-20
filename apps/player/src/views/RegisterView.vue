<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api } from '../api';

const auth = useAuthStore();
const router = useRouter();
const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);
const info = ref('');

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }
  const { publicKey } = await api<{ publicKey: string }>('/auth/push/public-key');
  if (!publicKey) {
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return;
  }
  await api('/auth/push/subscribe', {
    method: 'POST',
    json: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
  });
  await auth.resend();
}

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    const res = await auth.register({ name: name.value, email: email.value, password: password.value });
    info.value = `Письмо ушло. Локально смотри Mailhog http://localhost:8025`;
    try {
      await enablePush();
      info.value += ' Если разрешишь уведомления — придёт web push.';
    } catch {
      /* push optional */
    }
    await router.push('/me');
    return res;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="px-6 py-12">
    <h1 class="text-4xl font-black">Регистрация</h1>
    <p class="mt-2 text-white/70">Подтверждение — письмо или web push.</p>
    <form class="mt-8 flex flex-col gap-3" @submit.prevent="submit">
      <input v-model="name" placeholder="Имя" class="rounded-2xl bg-white/15 px-4 py-3 outline-none" />
      <input v-model="email" type="email" placeholder="Email" class="rounded-2xl bg-white/15 px-4 py-3 outline-none" />
      <input v-model="password" type="password" placeholder="Пароль от 6 символов" class="rounded-2xl bg-white/15 px-4 py-3 outline-none" />
      <button class="rounded-2xl bg-yellow-400 py-3 font-black text-[#46178f]" :disabled="busy">Создать</button>
    </form>
    <p v-if="info" class="mt-4 text-sm text-yellow-200">{{ info }}</p>
    <p v-if="error" class="mt-4 text-red-200">{{ error }}</p>
    <RouterLink to="/login" class="mt-6 inline-block underline">Уже есть аккаунт</RouterLink>
  </main>
</template>
