import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  WS_EVENTS,
  type AdShowPayload,
  type AnswerAcceptedPayload,
  type GameOverPayload,
  type LeaderboardPayload,
  type QuestionRevealPayload,
  type QuestionShowPayload,
  type RoomStatePayload,
  type RoundShowPayload,
  type WsAck,
} from '@quiz/shared';
import { socket } from '../socket';

export const useGameStore = defineStore('game', () => {
  const connected = ref(socket.connected);
  const error = ref('');
  const room = ref<RoomStatePayload | null>(null);
  const question = ref<QuestionShowPayload | null>(null);
  const reveal = ref<QuestionRevealPayload | null>(null);
  const accepted = ref<AnswerAcceptedPayload | null>(null);
  const podium = ref<GameOverPayload | null>(null);
  const roundInfo = ref<RoundShowPayload | null>(null);
  const board = ref<LeaderboardPayload | null>(null);
  const ad = ref<AdShowPayload | null>(null);

  const status = computed(() => room.value?.status ?? null);

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
      accepted.value = null;
    });
    socket.on(WS_EVENTS.ANSWER_ACCEPTED, (payload: AnswerAcceptedPayload) => {
      accepted.value = payload;
    });
    socket.on(WS_EVENTS.QUESTION_REVEAL, (payload: QuestionRevealPayload) => {
      reveal.value = payload;
    });
    socket.on(WS_EVENTS.LEADERBOARD, (payload: LeaderboardPayload) => {
      board.value = payload;
    });
    socket.on(WS_EVENTS.AD_SHOW, (payload: AdShowPayload) => {
      ad.value = payload;
    });
    socket.on(WS_EVENTS.GAME_OVER, (payload: GameOverPayload) => {
      podium.value = payload;
    });
  }

  async function createRoom(tvPassword: string) {
    error.value = '';
    const ack = (await socket.emitWithAck(WS_EVENTS.ROOM_CREATE, {
      as: 'tv',
      tvPassword,
    })) as WsAck<{
      code: string;
      state: RoomStatePayload;
    }>;
    if (!ack.ok || !ack.data) {
      error.value = ack.error ?? 'Не удалось создать комнату';
      return false;
    }
    room.value = ack.data.state;
    question.value = null;
    reveal.value = null;
    podium.value = null;
    return true;
  }

  async function joinAsTv(code: string, tvPassword: string) {
    error.value = '';
    const ack = (await socket.emitWithAck(WS_EVENTS.ROOM_JOIN, {
      code,
      role: 'tv',
      tvPassword,
    })) as WsAck<{ state: RoomStatePayload }>;
    if (!ack.ok || !ack.data) {
      error.value = ack.error ?? 'Не удалось подключить экран';
      return false;
    }
    room.value = ack.data.state;
    return true;
  }

  async function start() {
    error.value = '';
    const ack = (await socket.emitWithAck(WS_EVENTS.ROOM_START, {})) as WsAck;
    if (!ack.ok) {
      error.value = ack.error ?? 'Не удалось начать';
      return false;
    }
    return true;
  }

  async function next() {
    error.value = '';
    const ack = (await socket.emitWithAck(WS_EVENTS.ROOM_NEXT, {})) as WsAck;
    if (!ack.ok) {
      error.value = ack.error ?? 'Не удалось продолжить';
      return false;
    }
    return true;
  }

  async function leave() {
    try {
      await socket.emitWithAck(WS_EVENTS.ROOM_LEAVE, {});
    } catch {
      /* still clear locally */
    }
    room.value = null;
    question.value = null;
    reveal.value = null;
    accepted.value = null;
    podium.value = null;
    roundInfo.value = null;
    board.value = null;
    ad.value = null;
    error.value = '';
  }

  return {
    connected,
    error,
    room,
    question,
    reveal,
    accepted,
    podium,
    roundInfo,
    board,
    ad,
    status,
    bind,
    createRoom,
    joinAsTv,
    start,
    next,
    leave,
  };
});
