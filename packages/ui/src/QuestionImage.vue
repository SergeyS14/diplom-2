<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ url: string }>();
const unavailable = ref(false);
</script>

<template>
  <div v-if="unavailable" role="status" class="text-sm opacity-70">
    Изображение недоступно
  </div>
  <img
    v-else
    :src="url"
    alt="Иллюстрация к вопросу"
    class="block h-auto max-w-full rounded-xl object-contain"
    @error="unavailable = true"
  />
</template>
