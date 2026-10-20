import type { AvatarConfig } from './avatar';

export type ClientRole = 'tv' | 'player' | 'host';

export type SessionStatus =
  | 'lobby'
  | 'round'
  | 'playing'
  | 'question'
  | 'reveal'
  | 'leaderboard'
  | 'ad'
  | 'finished';

export type RoundType = 'STANDARD' | 'LIGHTNING' | 'FINAL';

export interface WsAck<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PlayerPublic {
  id: string;
  nickname: string;
  score: number;
  streak: number;
  connected: boolean;
  avatar: AvatarConfig | null;
  medals: string[];
  rating?: number;
}

export interface RoomStatePayload {
  code: string;
  status: SessionStatus;
  quizTitle: string;
  quizId: string;
  players: PlayerPublic[];
  currentIndex: number;
  totalQuestions: number;
  roundTitle: string | null;
  roundIndex: number;
  totalRounds: number;
}

export interface RoomCreatePayload {
  quizId?: string;
  as?: 'tv' | 'host';
  accessToken?: string;
  tvPassword?: string;
}

export interface RoomCreateResult {
  code: string;
  state: RoomStatePayload;
}

export interface RoomJoinPayload {
  code: string;
  role: ClientRole;
  nickname?: string;
  token?: string;
  accessToken?: string;
  tvPassword?: string;
}

export interface RoomJoinResult {
  playerId?: string;
  token?: string;
  state: RoomStatePayload;
}

export interface OptionPublic {
  id: string;
  text: string;
  color: string;
}

export interface QuestionShowPayload {
  questionId: string;
  index: number;
  total: number;
  text: string;
  mediaUrl: string | null;
  hint: string | null;
  timeLimit: number;
  startedAt: number;
  options: OptionPublic[];
  roundTitle: string;
}

export interface GameHistoryItem {
  id: string;
  quizTitle: string;
  score: number;
  place: number;
  players: number;
  createdAt: string;
}

export interface RoundShowPayload {
  roundIndex: number;
  totalRounds: number;
  title: string;
  type: RoundType;
}

export interface AnswerSubmitPayload {
  questionId: string;
  optionId: string;
  clientTs: number;
}

export interface AnswerAcceptedPayload {
  playerId: string;
  answeredCount: number;
  totalPlayers: number;
}

export interface RevealStat {
  optionId: string;
  count: number;
  isCorrect: boolean;
}

export interface RevealPlayer {
  id: string;
  nickname: string;
  score: number;
  delta: number;
  correct: boolean;
  avatar: AvatarConfig | null;
  medals: string[];
}

export interface QuestionRevealPayload {
  questionId: string;
  correctOptionIds: string[];
  stats: RevealStat[];
  players: RevealPlayer[];
}

export interface LeaderboardPayload {
  title: string;
  players: PlayerPublic[];
}

export interface AdShowPayload {
  title: string;
  body: string;
  mediaUrl: string;
  cta: string | null;
  durationSec: number;
}

export interface GameOverPayload {
  players: PlayerPublic[];
  unlocked: Record<string, string[]>;
}

export interface WsErrorPayload {
  code: string;
  message: string;
}

export const OPTION_COLORS = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'] as const;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  role: 'PLAYER' | 'HOST' | 'ADMIN';
  emailVerified: boolean;
  avatar: AvatarConfig;
  rating: number;
  gamesPlayed: number;
  wins: number;
  podiums: number;
  totalScore: number;
  bestScore: number;
  correctAnswers: number;
  bestStreak: number;
  medals: string[];
}
