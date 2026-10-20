import { timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, SessionStatus as DbSessionStatus } from '@prisma/client';
import {
  calcPoints,
  OPTION_COLORS,
  parseAvatar,
  randomAvatar,
  type AdShowPayload,
  type AnswerAcceptedPayload,
  type AvatarConfig,
  type GameOverPayload,
  type LeaderboardPayload,
  type PlayerPublic,
  type QuestionRevealPayload,
  type QuestionShowPayload,
  type RoomJoinPayload,
  type RoomStatePayload,
  type RoundShowPayload,
  type RoundType,
  type SessionStatus,
  WS_EVENTS,
} from '@quiz/shared';
import { PrismaService } from '../prisma/prisma.service';
import { userFromToken } from '../auth/jwt.guard';
import { generateRoomCode, newPlayerToken } from './room-code';

const MAX_PLAYERS = 50;
const ROUND_MS = 10_000;
const REVEAL_MS = 8_000;
const LEADERBOARD_MS = 12_000;
const PODIUM_MS = 18_000;
const LOBBY_AUTOSTART_MS = 10_000;
const AD_MIN_SEC = 14;

export class GameError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface CachedOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
  color: string;
}

interface CachedQuestion {
  id: string;
  roundId: string;
  roundTitle: string;
  text: string;
  mediaUrl: string | null;
  hint: string | null;
  timeLimit: number;
  points: number;
  options: CachedOption[];
}

interface CachedAd {
  title: string;
  body: string;
  mediaUrl: string;
  cta: string | null;
  durationSec: number;
}

type Beat =
  | { kind: 'round'; roundIndex: number; totalRounds: number; title: string; type: RoundType; roundId: string; questionCount: number }
  | { kind: 'question'; question: CachedQuestion; index: number }
  | { kind: 'leaderboard'; title: string; roundId: string }
  | { kind: 'ad'; ad: CachedAd };

interface LivePlayer {
  id: string;
  userId: string | null;
  nickname: string;
  score: number;
  streak: number;
  maxStreak: number;
  connected: boolean;
  socketId: string;
  token: string;
  avatar: AvatarConfig | null;
  medals: string[];
  rating?: number;
  hadSpeed: boolean;
  correctInRound: number;
  hadPerfectRound: boolean;
  correctThisMatch: number;
}

interface RoundAnswer {
  optionId: string;
  timeMs: number;
  points: number;
  correct: boolean;
}

interface LiveRoom {
  code: string;
  sessionId: string;
  quizId: string;
  quizTitle: string;
  status: SessionStatus;
  tvSocketIds: Set<string>;
  hostSocketIds: Set<string>;
  players: Map<string, LivePlayer>;
  socketToPlayer: Map<string, string>;
  questions: CachedQuestion[];
  timeline: Beat[];
  beatIndex: number;
  currentIndex: number;
  roundTitle: string | null;
  roundIndex: number;
  totalRounds: number;
  activeRoundId: string | null;
  roundQuestionCount: number;
  questionStartedAt: number;
  answersThisRound: Map<string, RoundAnswer>;
  currentOptions: CachedOption[];
  currentAd: CachedAd | null;
  timer?: NodeJS.Timeout;
  advancing?: boolean;
}

export interface RoomBroadcasts {
  emitToRoom(code: string, event: string, payload: unknown): void;
}

const STATUS_TO_DB: Record<SessionStatus, DbSessionStatus> = {
  lobby: 'LOBBY',
  round: 'ROUND',
  playing: 'PLAYING',
  question: 'QUESTION',
  reveal: 'REVEAL',
  leaderboard: 'LEADERBOARD',
  ad: 'AD',
  finished: 'FINISHED',
};

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly rooms = new Map<string, LiveRoom>();
  private readonly socketRooms = new Map<string, string>();
  private broadcasts: RoomBroadcasts | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private assertTvPassword(password?: string) {
    const expected = (this.config.get<string>('TV_PASSWORD') || 'show123').trim();
    if (!password || password.length !== expected.length) {
      throw new GameError('TV_PASSWORD', 'Неверный пароль показа');
    }
    if (!timingSafeEqual(Buffer.from(password), Buffer.from(expected))) {
      throw new GameError('TV_PASSWORD', 'Неверный пароль показа');
    }
  }

  setBroadcasts(broadcasts: RoomBroadcasts) {
    this.broadcasts = broadcasts;
  }

  toPublicState(room: LiveRoom): RoomStatePayload {
    return {
      code: room.code,
      status: room.status,
      quizTitle: room.quizTitle,
      quizId: room.quizId,
      currentIndex: room.currentIndex,
      totalQuestions: room.questions.length,
      roundTitle: room.roundTitle,
      roundIndex: room.roundIndex,
      totalRounds: room.totalRounds,
      players: this.playersPublic(room),
    };
  }

  getRoomBySocket(socketId: string) {
    const code = this.socketRooms.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  async createRoom(
    socketId: string,
    quizId?: string,
    as: 'tv' | 'host' = 'tv',
    accessToken?: string,
    tvPassword?: string,
  ) {
    if (as !== 'tv') {
      throw new GameError('TV_ONLY', 'Показ запускается только с ТВ-экрана');
    }
    this.assertTvPassword(tvPassword);

    const quiz = await this.loadQuiz(quizId);
    const code = generateRoomCode();
    const host = await userFromToken(accessToken, this.jwt, this.prisma);

    const session = await this.prisma.gameSession.create({
      data: {
        quizId: quiz.id,
        code,
        status: 'LOBBY',
        hostUserId: host?.id,
      },
    });

    const room: LiveRoom = {
      code,
      sessionId: session.id,
      quizId: quiz.id,
      quizTitle: quiz.title,
      status: 'lobby',
      tvSocketIds: new Set([socketId]),
      hostSocketIds: new Set(),
      players: new Map(),
      socketToPlayer: new Map(),
      questions: quiz.questions,
      timeline: quiz.timeline,
      beatIndex: -1,
      currentIndex: -1,
      roundTitle: null,
      roundIndex: 0,
      totalRounds: quiz.totalRounds,
      activeRoundId: null,
      roundQuestionCount: 0,
      questionStartedAt: 0,
      answersThisRound: new Map(),
      currentOptions: [],
      currentAd: null,
    };

    this.rooms.set(code, room);
    this.socketRooms.set(socketId, code);

    return { code, state: this.toPublicState(room) };
  }

  async joinRoom(socketId: string, params: RoomJoinPayload) {
    const code = params.code.replace(/\D/g, '').padStart(6, '0').slice(-6);
    const room = this.rooms.get(code);
    if (!room) {
      throw new GameError('ROOM_NOT_FOUND', 'Комната не найдена или уже закрыта');
    }

    if (params.role === 'tv') {
      this.assertTvPassword(params.tvPassword);
      room.tvSocketIds.add(socketId);
      this.socketRooms.set(socketId, code);
      return { state: this.toPublicState(room) };
    }

    if (params.role === 'host') {
      throw new GameError('TV_ONLY', 'Ведущий из аккаунта не нужен — показ идёт с ТВ');
    }

    if (params.token) {
      const existing = [...room.players.values()].find((p) => p.token === params.token);
      if (existing) {
        existing.socketId = socketId;
        existing.connected = true;
        room.socketToPlayer.set(socketId, existing.id);
        this.socketRooms.set(socketId, code);
        await this.prisma.sessionPlayer.update({
          where: { id: existing.id },
          data: { connected: true },
        });
        this.emitState(room);
        return {
          playerId: existing.id,
          token: existing.token,
          state: this.toPublicState(room),
        };
      }
    }

    const account = await userFromToken(params.accessToken, this.jwt, this.prisma);
    const profile = account
      ? await this.prisma.user.findUnique({
          where: { id: account.id },
          include: { achievements: true },
        })
      : null;

    const nickname = (
      params.nickname ||
      profile?.nickname ||
      profile?.name ||
      ''
    )
      .trim()
      .slice(0, 20);
    if (nickname.length < 1) {
      throw new GameError('NICKNAME_REQUIRED', 'Введите ник');
    }

    if (room.players.size >= MAX_PLAYERS) {
      throw new GameError('ROOM_FULL', `Максимум ${MAX_PLAYERS} игроков`);
    }

    const token = newPlayerToken();
    const avatar = profile ? parseAvatar(profile.avatar) : randomAvatar();
    const medals = profile?.achievements.map((a) => a.achievementId) ?? [];

    const playerRow = await this.prisma.sessionPlayer.create({
      data: {
        sessionId: room.sessionId,
        userId: profile?.id,
        nickname,
        avatar: avatar ? (avatar as object as Prisma.InputJsonValue) : undefined,
        medals,
        playerToken: token,
        connected: true,
      },
    });

    const player: LivePlayer = {
      id: playerRow.id,
      userId: profile?.id ?? null,
      nickname,
      score: 0,
      streak: 0,
      maxStreak: 0,
      connected: true,
      socketId,
      token,
      avatar,
      medals,
      rating: profile?.rating,
      hadSpeed: false,
      correctInRound: 0,
      hadPerfectRound: false,
      correctThisMatch: 0,
    };

    room.players.set(player.id, player);
    room.socketToPlayer.set(socketId, player.id);
    this.socketRooms.set(socketId, code);

    this.emitState(room);
    this.scheduleAutoStart(room);

    return {
      playerId: player.id,
      token,
      state: this.toPublicState(room),
    };
  }

  async startGame(socketId: string) {
    const room = this.requireControl(socketId);
    await this.startGameInternal(room);
    return { state: this.toPublicState(room) };
  }

  async next(socketId: string) {
    const room = this.requireControl(socketId);
    if (!['reveal', 'leaderboard', 'ad'].includes(room.status)) {
      throw new GameError('BAD_STATUS', 'Сейчас нельзя перейти дальше');
    }
    if (room.advancing) {
      throw new GameError('BUSY', 'Уже переключаем сцену');
    }
    await this.advance(room);
    return { state: this.toPublicState(room) };
  }

  async submitAnswer(
    socketId: string,
    payload: { questionId: string; optionId: string; clientTs: number },
  ): Promise<AnswerAcceptedPayload> {
    const room = this.requireRoom(socketId);
    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) {
      throw new GameError('NOT_PLAYER', 'Отвечать могут только игроки');
    }

    if (room.status !== 'question') {
      throw new GameError('NOT_ACCEPTING', 'Сейчас ответы не принимаются');
    }

    const beat = room.timeline[room.beatIndex];
    if (!beat || beat.kind !== 'question' || beat.question.id !== payload.questionId) {
      throw new GameError('WRONG_QUESTION', 'Это уже не тот вопрос');
    }

    if (room.answersThisRound.has(playerId)) {
      throw new GameError('ALREADY_ANSWERED', 'Ответ уже принят');
    }

    const question = beat.question;
    const option = question.options.find((o) => o.id === payload.optionId);
    if (!option) {
      throw new GameError('BAD_OPTION', 'Нет такого варианта');
    }

    const serverTs = Date.now();
    const timeMs = Math.min(
      Math.max(serverTs - room.questionStartedAt, 0),
      question.timeLimit * 1000,
    );

    const player = room.players.get(playerId)!;
    const correct = option.isCorrect;
    const nextStreak = correct ? player.streak + 1 : 0;
    const points = calcPoints({
      isCorrect: correct,
      timeMs,
      timeLimitMs: question.timeLimit * 1000,
      base: question.points,
      streak: player.streak,
    });

    player.score += points;
    player.streak = nextStreak;
    player.maxStreak = Math.max(player.maxStreak, nextStreak);
    if (correct) {
      player.correctInRound += 1;
      player.correctThisMatch += 1;
      if (timeMs < 2000) {
        player.hadSpeed = true;
      }
    }
    room.answersThisRound.set(playerId, {
      optionId: option.id,
      timeMs,
      points,
      correct,
    });

    await this.prisma.sessionAnswer.create({
      data: {
        sessionId: room.sessionId,
        playerId,
        questionId: question.id,
        optionId: option.id,
        isCorrect: correct,
        timeMs,
        pointsAwarded: points,
      },
    });

    await this.prisma.sessionPlayer.update({
      where: { id: playerId },
      data: { score: player.score, streak: player.streak, maxStreak: player.maxStreak },
    });

    const accepted: AnswerAcceptedPayload = {
      playerId,
      answeredCount: room.answersThisRound.size,
      totalPlayers: [...room.players.values()].filter((p) => p.connected).length,
    };

    this.broadcasts?.emitToRoom(room.code, WS_EVENTS.ANSWER_ACCEPTED, accepted);

    return accepted;
  }

  async leaveRoom(socketId: string) {
    const room = this.getRoomBySocket(socketId);
    if (!room) {
      return { left: true };
    }

    const playerId = room.socketToPlayer.get(socketId);
    if (playerId) {
      const player = room.players.get(playerId);
      if (player && player.socketId === socketId) {
        room.players.delete(playerId);
        await this.prisma.sessionPlayer
          .update({
            where: { id: playerId },
            data: { connected: false },
          })
          .catch(() => undefined);
        this.broadcasts?.emitToRoom(room.code, WS_EVENTS.PLAYER_LEFT, { playerId, nickname: player.nickname });
      }
      room.socketToPlayer.delete(socketId);
    }

    room.tvSocketIds.delete(socketId);
    room.hostSocketIds.delete(socketId);
    this.socketRooms.delete(socketId);
    this.emitState(room);
    return { left: true };
  }

  async handleDisconnect(socketId: string) {
    const room = this.getRoomBySocket(socketId);
    if (!room) {
      return;
    }

    room.tvSocketIds.delete(socketId);
    room.hostSocketIds.delete(socketId);

    const playerId = room.socketToPlayer.get(socketId);
    if (playerId) {
      const player = room.players.get(playerId);
      if (player && player.socketId === socketId) {
        player.connected = false;
        await this.prisma.sessionPlayer
          .update({
            where: { id: playerId },
            data: { connected: false },
          })
          .catch(() => undefined);
      }
      room.socketToPlayer.delete(socketId);
    }

    this.socketRooms.delete(socketId);
    this.emitState(room);
  }

  private requireRoom(socketId: string) {
    const room = this.getRoomBySocket(socketId);
    if (!room) {
      throw new GameError('NOT_IN_ROOM', 'Сначала войдите в комнату');
    }
    return room;
  }

  private requireControl(socketId: string) {
    const room = this.requireRoom(socketId);
    const isTv = room.tvSocketIds.has(socketId);
    const isHost = room.hostSocketIds.has(socketId);
    if (!isTv && !isHost) {
      throw new GameError('FORBIDDEN', 'Только экран или ведущий могут управлять игрой');
    }
    return room;
  }

  private async loadQuiz(quizId?: string) {
    const quiz = quizId
      ? await this.prisma.quiz.findFirst({
          where: { id: quizId, isPublished: true },
          include: quizInclude,
        })
      : await this.prisma.quiz.findFirst({
          where: { isPublished: true },
          orderBy: { createdAt: 'asc' },
          include: quizInclude,
        });

    const rounds = quiz?.rounds ?? [];
    const questionsFlat = rounds.flatMap((r) => r.questions);
    if (!quiz || questionsFlat.length === 0) {
      throw new GameError('NO_QUIZ', 'Нет опубликованного квиза с вопросами');
    }

    const questions: CachedQuestion[] = [];
    const timeline: Beat[] = [];
    let qIndex = 0;

    rounds.forEach((round, roundIndex) => {
      const cachedQs = round.questions.map((q) => ({
        id: q.id,
        roundId: round.id,
        roundTitle: round.title,
        text: q.text,
        mediaUrl: q.mediaUrl,
        hint: q.hint?.trim() || null,
        timeLimit: q.timeLimit,
        points: q.points,
        options: q.options.map((o, i) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
          order: o.order,
          color: o.color || OPTION_COLORS[i % OPTION_COLORS.length],
        })),
      }));
      questions.push(...cachedQs);
      timeline.push({
        kind: 'round',
        roundIndex,
        totalRounds: rounds.length,
        title: round.title,
        type: round.type,
        roundId: round.id,
        questionCount: cachedQs.length,
      });
      for (const q of cachedQs) {
        timeline.push({ kind: 'question', question: q, index: qIndex });
        qIndex += 1;
      }
      if (round.showLeaderboard) {
        timeline.push({ kind: 'leaderboard', title: `Рейтинг · ${round.title}`, roundId: round.id });
      }
      timeline.push({
        kind: 'ad',
        ad: round.ad
          ? {
              title: round.ad.title,
              body: round.ad.body,
              mediaUrl: round.ad.mediaUrl,
              cta: round.ad.cta,
              durationSec: Math.max(Number(round.ad.durationSec) || AD_MIN_SEC, AD_MIN_SEC),
            }
          : placeholderAd(round.title),
      });
    });

    return {
      id: quiz.id,
      title: quiz.title,
      questions,
      timeline,
      totalRounds: rounds.length,
    };
  }

  private async advance(room: LiveRoom) {
    if (room.advancing) {
      return;
    }
    room.advancing = true;
    try {
      await this.runAdvance(room);
    } finally {
      room.advancing = false;
    }
  }

  private async runAdvance(room: LiveRoom) {
    this.clearTimer(room);
    this.closeRoundIfNeeded(room);

    room.beatIndex += 1;
    const beat = room.timeline[room.beatIndex];
    if (!beat) {
      await this.finish(room);
      return;
    }

    if (beat.kind === 'round') {
      room.status = 'round';
      room.roundTitle = beat.title;
      room.roundIndex = beat.roundIndex;
      room.activeRoundId = beat.roundId;
      room.roundQuestionCount = beat.questionCount;
      for (const p of room.players.values()) {
        p.correctInRound = 0;
      }
      await this.persistStatus(room, 'round');
      const payload: RoundShowPayload = {
        roundIndex: beat.roundIndex,
        totalRounds: beat.totalRounds,
        title: beat.title,
        type: beat.type,
      };
      this.emitState(room);
      this.broadcasts?.emitToRoom(room.code, WS_EVENTS.ROUND_SHOW, payload);
      room.timer = setTimeout(() => {
        this.advance(room).catch((err) => this.logger.error(err));
      }, ROUND_MS);
      return;
    }

    if (beat.kind === 'question') {
      await this.beginQuestion(room, beat.question, beat.index);
      return;
    }

    if (beat.kind === 'leaderboard') {
      room.status = 'leaderboard';
      await this.persistStatus(room, 'leaderboard');
      const payload: LeaderboardPayload = {
        title: beat.title,
        players: this.playersPublic(room),
      };
      this.emitState(room);
      this.broadcasts?.emitToRoom(room.code, WS_EVENTS.LEADERBOARD, payload);
      room.timer = setTimeout(() => {
        this.advance(room).catch((err) => this.logger.error(err));
      }, LEADERBOARD_MS);
      return;
    }

    room.status = 'ad';
    room.currentAd = beat.ad;
    await this.persistStatus(room, 'ad');
    const payload: AdShowPayload = beat.ad;
    this.emitState(room);
    this.broadcasts?.emitToRoom(room.code, WS_EVENTS.AD_SHOW, payload);
    room.timer = setTimeout(() => {
      this.advance(room).catch((err) => this.logger.error(err));
    }, Math.max(Number(beat.ad.durationSec) || AD_MIN_SEC, AD_MIN_SEC) * 1000);
  }

  private closeRoundIfNeeded(room: LiveRoom) {
    const current = room.timeline[room.beatIndex];
    const next = room.timeline[room.beatIndex + 1];
    const leavingQuestions =
      current?.kind === 'question' && next?.kind !== 'question';
    if (!leavingQuestions) {
      return;
    }
    for (const p of room.players.values()) {
      if (room.roundQuestionCount > 0 && p.correctInRound >= room.roundQuestionCount) {
        p.hadPerfectRound = true;
      }
    }
  }

  private async beginQuestion(room: LiveRoom, question: CachedQuestion, index: number) {
    room.currentIndex = index;
    room.status = 'question';
    room.roundTitle = question.roundTitle;
    room.questionStartedAt = Date.now();
    room.answersThisRound = new Map();
    room.currentOptions = shuffleColoredOptions(question.options);

    await this.prisma.gameSession.update({
      where: { id: room.sessionId },
      data: {
        status: STATUS_TO_DB.question,
        currentQuestionId: question.id,
      },
    });

    const timeLimitSec = Math.max(Number(question.timeLimit) || 20, 1);
    const payload: QuestionShowPayload = {
      questionId: question.id,
      index,
      total: room.questions.length,
      text: question.text,
      mediaUrl: question.mediaUrl,
      hint: question.hint,
      timeLimit: timeLimitSec,
      startedAt: room.questionStartedAt,
      options: room.currentOptions.map((o) => ({
        id: o.id,
        text: o.text,
        color: o.color,
      })),
      roundTitle: question.roundTitle,
    };
    this.emitState(room);
    this.broadcasts?.emitToRoom(room.code, WS_EVENTS.QUESTION_SHOW, payload);

    room.timer = setTimeout(() => {
      this.reveal(room).catch((err) => this.logger.error(err));
    }, timeLimitSec * 1000);
  }

  private async reveal(room: LiveRoom) {
    if (room.status !== 'question') {
      return;
    }
    this.clearTimer(room);
    const beat = room.timeline[room.beatIndex];
    if (!beat || beat.kind !== 'question') {
      return;
    }
    const question = beat.question;
    const options = room.currentOptions.length ? room.currentOptions : question.options;
    room.status = 'reveal';
    await this.persistStatus(room, 'reveal');

    const counts = new Map<string, number>();
    for (const opt of options) {
      counts.set(opt.id, 0);
    }
    for (const answer of room.answersThisRound.values()) {
      counts.set(answer.optionId, (counts.get(answer.optionId) ?? 0) + 1);
    }

    const payload: QuestionRevealPayload = {
      questionId: question.id,
      correctOptionIds: options.filter((o) => o.isCorrect).map((o) => o.id),
      stats: options.map((o) => ({
        optionId: o.id,
        count: counts.get(o.id) ?? 0,
        isCorrect: o.isCorrect,
      })),
      players: [...room.players.values()]
        .map((p) => {
          const round = room.answersThisRound.get(p.id);
          return {
            id: p.id,
            nickname: p.nickname,
            score: p.score,
            delta: round?.points ?? 0,
            correct: round?.correct ?? false,
            avatar: p.avatar,
            medals: p.medals,
          };
        })
        .sort((a, b) => b.score - a.score),
    };

    this.emitState(room);
    this.broadcasts?.emitToRoom(room.code, WS_EVENTS.QUESTION_REVEAL, payload);
    room.timer = setTimeout(() => {
      this.advance(room).catch((err) => this.logger.error(err));
    }, REVEAL_MS);
  }

  private async finish(room: LiveRoom) {
    this.clearTimer(room);
    room.status = 'finished';
    await this.prisma.gameSession.update({
      where: { id: room.sessionId },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });

    const unlocked = await this.persistCareer(room);

    const payload: GameOverPayload = {
      players: this.playersPublic(room),
      unlocked,
    };

    this.emitState(room);
    this.broadcasts?.emitToRoom(room.code, WS_EVENTS.GAME_OVER, payload);
    room.timer = setTimeout(() => {
      this.beginNextLoop(room).catch((err) => this.logger.error(err));
    }, PODIUM_MS);
  }

  private async startGameInternal(room: LiveRoom) {
    if (room.status !== 'lobby') {
      throw new GameError('BAD_STATUS', 'Игру можно начать только из лобби');
    }
    if ([...room.players.values()].filter((p) => p.connected).length < 1) {
      throw new GameError('NO_PLAYERS', 'Нужен хотя бы один игрок');
    }
    if (room.advancing) {
      throw new GameError('BUSY', 'Уже переключаем сцену');
    }

    this.clearTimer(room);
    room.status = 'playing';
    await this.prisma.gameSession.update({
      where: { id: room.sessionId },
      data: { status: 'PLAYING', startedAt: new Date() },
    });

    room.beatIndex = -1;
    await this.advance(room);
  }

  private scheduleAutoStart(room: LiveRoom) {
    if (room.status !== 'lobby' || room.timer) {
      return;
    }
    room.timer = setTimeout(() => {
      room.timer = undefined;
      if (room.status !== 'lobby') {
        return;
      }
      const ready = [...room.players.values()].filter((p) => p.connected).length;
      if (ready < 1) {
        return;
      }
      this.startGameInternal(room).catch((err) => this.logger.error(err));
    }, LOBBY_AUTOSTART_MS);
  }

  private async beginNextLoop(room: LiveRoom) {
    this.clearTimer(room);
    for (const player of room.players.values()) {
      player.score = 0;
      player.streak = 0;
      player.maxStreak = 0;
      player.hadSpeed = false;
      player.correctInRound = 0;
      player.hadPerfectRound = false;
      player.correctThisMatch = 0;
      await this.prisma.sessionPlayer
        .update({
          where: { id: player.id },
          data: { score: 0, streak: 0 },
        })
        .catch(() => undefined);
    }
    room.beatIndex = -1;
    room.currentIndex = -1;
    room.roundTitle = null;
    room.answersThisRound = new Map();
    room.currentOptions = [];
    room.currentAd = null;
    room.status = 'lobby';
    await this.persistStatus(room, 'lobby');
    this.emitState(room);
    this.scheduleAutoStart(room);
  }

  private async persistCareer(room: LiveRoom) {
    const ranked = this.playersPublic(room);
    const unlocked: Record<string, string[]> = {};

    for (let place = 0; place < ranked.length; place += 1) {
      const pub = ranked[place];
      const live = room.players.get(pub.id);
      if (!live?.userId) {
        continue;
      }
      await this.prisma.gameResult.create({
        data: {
          userId: live.userId,
          quizTitle: room.quizTitle,
          score: live.score,
          place: place + 1,
          players: ranked.length,
        },
      });
      const user = await this.prisma.user.findUnique({
        where: { id: live.userId },
        include: { achievements: true },
      });
      if (!user || !user.emailVerified) {
        continue;
      }

      const placeRating = place === 0 ? 30 : place === 1 ? 15 : place === 2 ? 5 : -8;
      const correctCount = live.correctThisMatch;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          gamesPlayed: { increment: 1 },
          wins: { increment: place === 0 ? 1 : 0 },
          podiums: { increment: place < 3 ? 1 : 0 },
          totalScore: { increment: live.score },
          bestScore: Math.max(user.bestScore, live.score),
          correctAnswers: { increment: correctCount },
          bestStreak: Math.max(user.bestStreak, live.maxStreak),
          rating: Math.max(100, user.rating + placeRating),
        },
      });

      const ids = new Set(user.achievements.map((a) => a.achievementId));
      const earned: string[] = [];
      const mark = (id: string, ok: boolean) => {
        if (ok && !ids.has(id)) {
          earned.push(id);
        }
      };
      mark('first_game', true);
      mark('first_win', place === 0);
      mark('podium', place < 3);
      mark('streak_3', live.maxStreak >= 3);
      mark('perfect_round', live.hadPerfectRound);
      mark('speed', live.hadSpeed);
      mark('games_10', user.gamesPlayed + 1 >= 10);
      mark('score_5k', live.score >= 5000);

      if (earned.length) {
        await this.prisma.userAchievement.createMany({
          data: earned.map((achievementId) => ({ userId: user.id, achievementId })),
          skipDuplicates: true,
        });
        live.medals = [...ids, ...earned];
        unlocked[live.id] = earned;
        await this.prisma.sessionPlayer.update({
          where: { id: live.id },
          data: { medals: live.medals },
        });
      }
    }

    return unlocked;
  }

  private playersPublic(room: LiveRoom): PlayerPublic[] {
    return [...room.players.values()]
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        streak: p.streak,
        connected: p.connected,
        avatar: p.avatar,
        medals: p.medals,
        rating: p.rating,
      }))
      .sort((a, b) => b.score - a.score);
  }

  private emitState(room: LiveRoom) {
    this.broadcasts?.emitToRoom(room.code, WS_EVENTS.ROOM_STATE, this.toPublicState(room));
  }

  private persistStatus(room: LiveRoom, status: SessionStatus) {
    return this.prisma.gameSession.update({
      where: { id: room.sessionId },
      data: { status: STATUS_TO_DB[status] },
    });
  }

  private clearTimer(room: LiveRoom) {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = undefined;
    }
  }
}

function shuffleColoredOptions(options: CachedOption[]): CachedOption[] {
  const copy = [...options];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = current;
  }
  return copy.map((option, index) => ({
    ...option,
    color: OPTION_COLORS[index % OPTION_COLORS.length],
  }));
}

function placeholderAd(roundTitle: string): CachedAd {
  return {
    title: 'Тут могла быть ваша реклама',
    body: `Пауза после раунда «${roundTitle}». Здесь может быть ролик спонсора шоу.`,
    mediaUrl: '',
    cta: 'Стать спонсором',
    durationSec: AD_MIN_SEC,
  };
}

const quizInclude = {
  rounds: {
    orderBy: { order: 'asc' as const },
    include: {
      ad: true,
      questions: {
        orderBy: { order: 'asc' as const },
        include: { options: { orderBy: { order: 'asc' as const } } },
      },
    },
  },
};
