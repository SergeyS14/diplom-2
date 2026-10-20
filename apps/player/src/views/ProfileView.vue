<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  ACHIEVEMENTS,
  AVATAR_EYES,
  AVATAR_FACIAL,
  AVATAR_GLASSES,
  AVATAR_HAIR,
  AVATAR_MOUTHS,
  AVATAR_SKINS,
  DEFAULT_AVATAR,
  parseAvatar,
  randomAvatar,
  type GameHistoryItem,
} from '@quiz/shared';
import AvatarFace from '@quiz/ui/AvatarFace.vue';
import { useAuthStore } from '../stores/auth';
import { useGameStore } from '../stores/game';

const auth = useAuthStore();
const game = useGameStore();
const router = useRouter();
const name = ref('');
const nickname = ref('');
const avatar = reactive({ ...DEFAULT_AVATAR });
const saved = ref('');
const history = ref<GameHistoryItem[]>([]);
const labels: Record<string, string> = {
  normal: 'обычные',
  happy: 'весёлые',
  wink: 'подмигивание',
  angry: 'строгие',
  smile: 'улыбка',
  grin: 'ухмылка',
  smirk: 'вбок',
  o: 'о',
  none: 'нет',
  short: 'короткие',
  curly: 'кудри',
  long: 'длинные',
  round: 'круглые',
  square: 'квадратные',
  sunglasses: 'тёмные',
  mustache: 'усы',
  beard: 'борода',
};

const myMedals = computed(() =>
  ACHIEVEMENTS.filter((a) => auth.user?.medals.includes(a.id)),
);
const shownRating = computed(() => (auth.user && auth.user.gamesPlayed > 0 ? auth.user.rating : 0));

onMounted(async () => {
  if (!auth.token) {
    await router.replace('/login');
    return;
  }
  await auth.load();
  if (!auth.user) {
    await router.replace('/login');
    return;
  }
  name.value = auth.user.name;
  nickname.value = auth.user.nickname || '';
  Object.assign(avatar, parseAvatar(auth.user.avatar));
  try {
    history.value = await auth.games();
  } catch {
    history.value = [];
  }
});

async function save() {
  await auth.saveProfile({ name: name.value, nickname: nickname.value, avatar: { ...avatar } });
  saved.value = 'Сохранено';
}

async function resend() {
  const res = await auth.resend();
  saved.value = `Ссылка: ${res.verifyUrl}`;
}

function randomize() {
  Object.assign(avatar, randomAvatar());
}
</script>

<template>
  <main v-if="auth.user" class="px-6 py-8">
    <h1 class="text-4xl font-black">Профиль</h1>
    <p class="mt-1 text-white/60">{{ auth.user.email }} · {{ auth.user.role }}</p>
    <p v-if="!auth.user.emailVerified" class="mt-3 rounded-xl bg-yellow-400/20 p-3 text-sm">
      Аккаунт не подтверждён — рейтинг не пишется.
      <button class="underline" @click="resend">Отправить письмо и push</button>
    </p>

    <p v-if="game.room" class="mt-4 rounded-2xl bg-yellow-400/20 p-3 text-sm font-extrabold">
      Ты всё ещё в игре {{ game.room.code }}.
      <button class="underline" type="button" @click="router.push('/play')">Вернуться</button>
    </p>

    <div class="mt-6 flex items-center gap-4">
      <AvatarFace :avatar="avatar" :size="120" />
      <div>
        <p class="text-3xl font-black">{{ shownRating }} elo</p>
        <p class="text-white/70">{{ auth.user.gamesPlayed }} игр · {{ auth.user.wins }} побед</p>
        <p v-if="auth.user.gamesPlayed === 0" class="mt-1 text-xs text-white/50">
          Elo появится после первой доигранной партии. Очки за вопрос — это счёт в шоу, не рейтинг.
        </p>
        <button class="mt-2 text-sm underline" type="button" @click="randomize">Случайный аватар</button>
      </div>
    </div>

    <h2 class="mt-8 text-xl font-black">Конструктор аватарки</h2>
    <div class="mt-3 space-y-3 text-sm">
      <div>
        <p class="mb-1 text-white/60">Кожа</p>
        <button
          v-for="skin in AVATAR_SKINS"
          :key="skin"
          class="mr-2 h-8 w-8 rounded-full border-2"
          :style="{ background: skin, borderColor: avatar.skin === skin ? '#fff' : 'transparent' }"
          @click="avatar.skin = skin"
        />
      </div>
      <div>
        <p class="mb-1 text-white/60">Глаза</p>
        <button v-for="item in AVATAR_EYES" :key="item" class="mr-2 rounded-full bg-white/15 px-3 py-1" @click="avatar.eyes = item">
          {{ labels[item] }}
        </button>
      </div>
      <div>
        <p class="mb-1 text-white/60">Рот</p>
        <button v-for="item in AVATAR_MOUTHS" :key="item" class="mr-2 rounded-full bg-white/15 px-3 py-1" @click="avatar.mouth = item">
          {{ labels[item] }}
        </button>
      </div>
      <div>
        <p class="mb-1 text-white/60">Волосы</p>
        <button v-for="item in AVATAR_HAIR" :key="item" class="mr-2 rounded-full bg-white/15 px-3 py-1" @click="avatar.hair = item">
          {{ labels[item] }}
        </button>
      </div>
      <div>
        <p class="mb-1 text-white/60">Очки</p>
        <button v-for="item in AVATAR_GLASSES" :key="item" class="mr-2 rounded-full bg-white/15 px-3 py-1" @click="avatar.glasses = item">
          {{ labels[item] }}
        </button>
      </div>
      <div>
        <p class="mb-1 text-white/60">Усы / борода</p>
        <button v-for="item in AVATAR_FACIAL" :key="item" class="mr-2 rounded-full bg-white/15 px-3 py-1" @click="avatar.facial = item">
          {{ labels[item] }}
        </button>
      </div>
      <label class="flex items-center gap-2">
        <input v-model="avatar.blush" type="checkbox" />
        Румянец
      </label>
    </div>

    <div class="mt-6 flex flex-col gap-3">
      <input v-model="name" class="rounded-2xl bg-white/15 px-4 py-3 outline-none" placeholder="Имя" />
      <input v-model="nickname" class="rounded-2xl bg-white/15 px-4 py-3 outline-none" placeholder="Ник в игре" />
      <button class="rounded-2xl bg-yellow-400 py-3 font-black text-[#46178f]" @click="save">Сохранить профиль</button>
    </div>
    <p v-if="saved" class="mt-3 text-sm text-yellow-200">{{ saved }}</p>

    <h2 class="mt-10 text-xl font-black">Достижения</h2>
    <div class="mt-3 grid grid-cols-2 gap-3">
      <div
        v-for="item in ACHIEVEMENTS"
        :key="item.id"
        class="rounded-2xl p-3"
        :class="myMedals.some((m) => m.id === item.id) ? 'bg-yellow-400 text-[#46178f]' : 'bg-white/10 opacity-50'"
      >
        <p class="text-2xl">{{ item.icon }}</p>
        <p class="font-black">{{ item.title }}</p>
        <p class="text-xs">{{ item.description }}</p>
      </div>
    </div>

    <h2 class="mt-10 text-xl font-black">История игр</h2>
    <ul v-if="history.length" class="mt-3 space-y-2">
      <li
        v-for="item in history"
        :key="item.id"
        class="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
      >
        <div>
          <p class="font-black">{{ item.quizTitle }}</p>
          <p class="text-sm text-white/60">{{ new Date(item.createdAt).toLocaleString('ru-RU') }}</p>
        </div>
        <div class="text-right font-extrabold">
          <p>{{ item.place }} / {{ item.players }} место</p>
          <p class="text-yellow-300">{{ item.score }} очков</p>
        </div>
      </li>
    </ul>
    <p v-else class="mt-3 text-white/50">Пока нет сыгранных партий</p>

    <button class="mt-8 text-sm underline" @click="auth.logout(); router.push('/')">Выйти из аккаунта</button>
  </main>
</template>
