<script setup lang="ts">
import { computed, useId } from 'vue';
import { parseAvatar, type AvatarConfig } from '@quiz/shared';

const props = defineProps<{
  avatar?: AvatarConfig | null;
  size?: number;
}>();

const a = computed(() => parseAvatar(props.avatar));
const size = computed(() => props.size ?? 96);
const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
const faceHole = computed(() => `face-${uid}`);
const headClip = computed(() => `head-${uid}`);
const grinClip = computed(() => `grin-${uid}`);
const hairColor = '#3D2314';
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 120 120"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <clipPath :id="headClip">
        <circle cx="60" cy="56" r="34" />
      </clipPath>
      <mask :id="faceHole">
        <rect width="120" height="120" fill="white" />
        <circle cx="60" cy="56" r="34" fill="black" />
      </mask>
      <clipPath :id="grinClip">
        <path d="M44 76 Q60 94 76 76 Q60 84 44 76 Z" />
      </clipPath>
    </defs>

    <!-- long hair only to the sides of the face -->
    <g v-if="a.hair === 'long'" :fill="hairColor" :mask="`url(#${faceHole})`">
      <path d="M28 50 C16 58 18 96 30 112 C36 100 38 72 36 56 C34 50 30 48 28 50 Z" />
      <path d="M92 50 C104 58 102 96 90 112 C84 100 82 72 84 56 C86 50 90 48 92 50 Z" />
    </g>

    <circle cx="60" cy="56" r="34" :fill="a.skin" />
    <ellipse cx="28" cy="58" rx="6" ry="8" :fill="a.skin" />
    <ellipse cx="92" cy="58" rx="6" ry="8" :fill="a.skin" />

    <g v-if="a.hair === 'short' || a.hair === 'long' || a.hair === 'curly'" :clip-path="`url(#${headClip})`">
      <rect x="24" y="20" width="72" height="26" :fill="hairColor" />
    </g>

    <g v-if="a.hair === 'curly'" :fill="hairColor">
      <circle cx="42" cy="26" r="8" />
      <circle cx="58" cy="21" r="9" />
      <circle cx="74" cy="23" r="8" />
      <circle cx="85" cy="32" r="7" />
      <circle cx="35" cy="33" r="7" />
    </g>

    <g v-if="a.blush" fill="#F08A8A" opacity="0.42">
      <ellipse cx="42" cy="66" rx="7" ry="4.5" />
      <ellipse cx="78" cy="66" rx="7" ry="4.5" />
    </g>

    <g fill="#1a1a1a">
      <template v-if="a.eyes === 'wink'">
        <ellipse cx="46" cy="52" rx="5.5" ry="6.5" />
        <path d="M68 52 Q76 48 84 52" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round" />
      </template>
      <template v-else-if="a.eyes === 'happy'">
        <path d="M40 54 Q46 46 52 54" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round" />
        <path d="M68 54 Q74 46 80 54" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round" />
      </template>
      <template v-else-if="a.eyes === 'angry'">
        <path d="M38 46 L54 50" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round" />
        <path d="M82 46 L66 50" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round" />
        <circle cx="46" cy="54" r="5" />
        <circle cx="74" cy="54" r="5" />
      </template>
      <template v-else>
        <circle cx="46" cy="52" r="6" />
        <circle cx="74" cy="52" r="6" />
        <circle cx="48" cy="50" r="2" fill="#fff" />
        <circle cx="76" cy="50" r="2" fill="#fff" />
      </template>
    </g>

    <path
      v-if="a.facial === 'beard'"
      d="M36 72 Q38 96 60 100 Q82 96 84 72 Q70 88 60 90 Q50 88 36 72"
      :fill="hairColor"
    />

    <g stroke-linecap="round">
      <path
        v-if="a.mouth === 'smile'"
        d="M46 76 Q60 88 74 76"
        fill="none"
        stroke="#8B3A3A"
        stroke-width="3"
      />
      <g v-else-if="a.mouth === 'grin'">
        <path d="M44 76 Q60 94 76 76 Q60 84 44 76 Z" fill="#8B2E2E" />
        <rect x="48" y="78" width="24" height="6" fill="#F5F0E8" :clip-path="`url(#${grinClip})`" />
      </g>
      <path
        v-else-if="a.mouth === 'smirk'"
        d="M54 78 Q66 86 78 74"
        fill="none"
        stroke="#8B3A3A"
        stroke-width="3"
      />
      <ellipse v-else cx="60" cy="80" rx="6" ry="7" fill="#8B3A3A" />
    </g>

    <g v-if="a.facial === 'mustache'" :fill="hairColor">
      <path d="M45 72 C51 77 56 77 59 72 C55 75 50 75 45 72" />
      <path d="M75 72 C69 77 64 77 61 72 C65 75 70 75 75 72" />
    </g>

    <g v-if="a.glasses !== 'none'" fill="none" stroke="#222" stroke-width="3">
      <circle
        v-if="a.glasses !== 'square'"
        cx="46"
        cy="52"
        r="12"
        :fill="a.glasses === 'sunglasses' ? '#111' : 'rgba(255,255,255,0.15)'"
        :opacity="a.glasses === 'sunglasses' ? 0.72 : 1"
      />
      <circle
        v-if="a.glasses !== 'square'"
        cx="74"
        cy="52"
        r="12"
        :fill="a.glasses === 'sunglasses' ? '#111' : 'rgba(255,255,255,0.15)'"
        :opacity="a.glasses === 'sunglasses' ? 0.72 : 1"
      />
      <rect
        v-if="a.glasses === 'square'"
        x="34"
        y="42"
        width="24"
        height="20"
        rx="3"
        fill="rgba(255,255,255,0.12)"
      />
      <rect
        v-if="a.glasses === 'square'"
        x="62"
        y="42"
        width="24"
        height="20"
        rx="3"
        fill="rgba(255,255,255,0.12)"
      />
      <path d="M58 52 H62" />
    </g>
  </svg>
</template>
