import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  WS_EVENTS,
  type AdShowPayload,
  type GameOverPayload,
  type LeaderboardPayload,
  type QuestionRevealPayload,
  type QuestionShowPayload,
  type RoomJoinResult,
  type RoomStatePayload,
  type RoundShowPayload,
  type WsAck,
} from '@quiz/shared';
import { socket } from '../socket';
import { useAuthStore } from './auth';

const TOKEN_KEY = 'quiz_player_token';

export const useGameStore = defineStore('game', () => {
  const connected = ref(socket.connected);
  const error = ref('');
  const room = ref<RoomStatePayload | null>(null);
  const playerId = ref<string | null>(null);
  const token = ref(localStorage.getItem(TOKEN_KEY));
  const nickname = ref('');
  const question = ref<QuestionShowPayload | null>(null);
  const reveal = ref<QuestionRevealPayload | null>(null);
  const roundInfo = ref<RoundShowPayload | null>(null);
  const board = ref<LeaderboardPayload | null>(null);
  const ad = ref<AdShowPayload | null>(null);
  const over = ref<GameOverPayload | null>(null);
  const locked = ref(false);
  const pickedOptionId = ref<string | null>(null);

  const me = computed(() => room.value?.players.find((p) => p.id === playerId.value) ?? null);

  function resetPlay() {
    room.value = null;
    playerId.value = null;
    token.value = null;
    question.value = null;
    reveal.value = null;
    roundInfo.value = null;
    board.value = null;
    ad.value = null;
    over.value = null;
    locked.value = false;
    pickedOptionId.value = null;
    error.value = '';
    localStorage.removeItem(TOKEN_KEY);
  }

  function bind() {
    socket.on('connect', () => {
      connected.value = true;
    });
    socket.on('disconnect', () => {
      connected.value = false;
    });
    socket.on(WS_EVENTS.ROOM_STATE, (state: RoomStatePayload) => {
      room.value = state;
    });
    socket.on(WS_EVENTS.ROUND_SHOW, (payload: RoundShowPayload) => {
      roundInfo.value = payload;
    });
    socket.on(WS_EVENTS.QUESTION_SHOW, (payload: QuestionShowPayload) => {
      question.value = payload;
      reveal.value = null;
      locked.value = false;
      pickedOptionId.value = null;
    });
    socket.on(WS_EVENTS.QUESTION_REVEAL, (payload: QuestionRevealPayload) => {
      reveal.value = payload;
      locked.value = true;
    });
    socket.on(WS_EVENTS.LEADERBOARD, (payload: LeaderboardPayload) => {
      board.value = payload;
    });
    socket.on(WS_EVENTS.AD_SHOW, (payload: AdShowPayload) => {
      ad.value = payload;
    });
    socket.on(WS_EVENTS.GAME_OVER, (payload: GameOverPayload) => {
      over.value = payload;
      locked.value = true;
    });
  }

  async function join(code: string, name: string) {
    error.value = '';
    nickname.value = name.trim();
    const auth = useAuthStore();
    const ack = (await socket.emitWithAck(WS_EVENTS.ROOM_JOIN, {
      code,
      role: 'player',
      nickname: nickname.value || undefined,
      token: token.value || undefined,
      accessToken: auth.token || undefined,
    })) as WsAck<RoomJoinResult>;

    if (!ack.ok || !ack.data) {
      error.value = ack.error ?? 'Не удалось войти';
      return false;
    }

    room.value = ack.data.state;
    playerId.value = ack.data.playerId ?? null;
    if (ack.data.token) {
      token.value = ack.data.token;
      localStorage.setItem(TOKEN_KEY, ack.data.token);
    }
    return true;
  }

  async function submit(optionId: string) {
    if (!question.value || locked.value) {
      return;
    }
    locked.value = true;
    pickedOptionId.value = optionId;
    const ack = (await socket.emitWithAck(WS_EVENTS.ANSWER_SUBMIT, {
      questionId: question.value.questionId,
      optionId,
      clientTs: Date.now(),
    })) as WsAck;

    if (!ack.ok) {
      locked.value = false;
      pickedOptionId.value = null;
      error.value = ack.error ?? 'Ответ не принят';
    } else if (navigator.vibrate) {
      navigator.vibrate(40);
    }
  }

  async function leave() {
    try {
      await socket.emitWithAck(WS_EVENTS.ROOM_LEAVE, {});
    } catch {
      /* offline leave still clears local state */
    }
    resetPlay();
  }

  return {
    connected,
    error,
    room,
    playerId,
    nickname,
    question,
    reveal,
    roundInfo,
    board,
    ad,
    over,
    locked,
    pickedOptionId,
    me,
    bind,
    join,
    submit,
    leave,
    resetPlay,
  };
});
