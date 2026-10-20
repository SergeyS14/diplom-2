export const WS_EVENTS = {
  PING: 'ping',
  PONG: 'pong',

  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_START: 'room:start',
  ROOM_NEXT: 'room:next',
  ROOM_STATE: 'room:state',

  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',

  ANSWER_SUBMIT: 'answer:submit',
  ANSWER_ACCEPTED: 'answer:accepted',

  ROUND_SHOW: 'round:show',
  QUESTION_SHOW: 'question:show',
  QUESTION_REVEAL: 'question:reveal',
  LEADERBOARD: 'leaderboard',
  AD_SHOW: 'ad:show',
  GAME_OVER: 'game:over',

  ERROR: 'error',
} as const;

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
