<script setup lang="ts">
defineProps<{ url: string }>();
</script>

<template>
  <video v-if="/\.(mp4|webm|ogv)(?:[?#]|$)/i.test(url)" :src="url" :key="url" autoplay muted playsinline loop class="mx-auto mt-5 max-h-72 max-w-full rounded-2xl" />
  <img v-else-if="url" :src="url" alt="" class="mx-auto mt-5 max-h-72 max-w-full rounded-2xl object-contain" />
</template>
