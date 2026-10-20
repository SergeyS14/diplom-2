import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OPTION_COLORS } from '@quiz/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/jwt.guard';

@Injectable()
export class StudioService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertHost(user: AuthUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Студия только для админа');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('Сначала подтверди аккаунт');
    }
  }

  private async ownedQuiz(user: AuthUser, quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Квиз не найден');
    }
    if (quiz.ownerId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Это не ваш квиз');
    }
    return quiz;
  }

  list(user: AuthUser) {
    return this.prisma.quiz.findMany({
      where: user.role === 'ADMIN' ? {} : { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        rounds: { orderBy: { order: 'asc' }, include: { _count: { select: { questions: true } } } },
      },
    });
  }

  async get(user: AuthUser, quizId: string) {
    await this.ownedQuiz(user, quizId);
    return this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: {
        rounds: {
          orderBy: { order: 'asc' },
          include: {
            ad: true,
            questions: {
              orderBy: { order: 'asc' },
              include: { options: { orderBy: { order: 'asc' } } },
            },
          },
        },
      },
    });
  }

  async createQuiz(user: AuthUser, dto: { title: string; description?: string }) {
    await this.assertHost(user);
    const quiz = await this.prisma.quiz.create({
      data: {
        ownerId: user.id,
        title: (dto.title || 'Новый квиз').trim().slice(0, 80),
        description: dto.description?.trim() || null,
        rounds: {
          create: { title: 'Раунд 1', order: 1, type: 'STANDARD', showLeaderboard: true },
        },
      },
    });
    return this.get(user, quiz.id);
  }

  async updateQuiz(
    user: AuthUser,
    quizId: string,
    dto: { title?: string; description?: string; defaultQuestionTime?: number; isPublished?: boolean },
  ) {
    await this.ownedQuiz(user, quizId);
    if (dto.isPublished) {
      const full = await this.get(user, quizId);
      const questions = full.rounds.flatMap((r) => r.questions);
      if (questions.length < 1) {
        throw new BadRequestException('Чтобы опубликовать, нужен хотя бы один вопрос');
      }
      const invalid = questions.some((q) => !q.options.some((o) => o.isCorrect));
      if (invalid) {
        throw new BadRequestException('У каждого вопроса должен быть верный вариант');
      }
      if (user.emailVerified) {
        await this.prisma.userAchievement.upsert({
          where: { userId_achievementId: { userId: user.id, achievementId: 'author' } },
          create: { userId: user.id, achievementId: 'author' },
          update: {},
        });
      }
    }
    await this.prisma.quiz.update({
      where: { id: quizId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim().slice(0, 80) } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.defaultQuestionTime !== undefined ? { defaultQuestionTime: dto.defaultQuestionTime } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
      },
    });
    return this.get(user, quizId);
  }

  async removeQuiz(user: AuthUser, quizId: string) {
    await this.ownedQuiz(user, quizId);
    await this.prisma.quiz.delete({ where: { id: quizId } });
    return { ok: true };
  }

  async addRound(user: AuthUser, quizId: string, dto: { title?: string }) {
    await this.ownedQuiz(user, quizId);
    const count = await this.prisma.round.count({ where: { quizId } });
    await this.prisma.round.create({
      data: {
        quizId,
        title: dto.title?.trim() || `Раунд ${count + 1}`,
        order: count + 1,
        type: 'STANDARD',
        showLeaderboard: true,
      },
    });
    return this.get(user, quizId);
  }

  async updateRound(
    user: AuthUser,
    roundId: string,
    dto: {
      title?: string;
      type?: 'STANDARD' | 'LIGHTNING' | 'FINAL';
      showLeaderboard?: boolean;
      adId?: string | null;
    },
  ) {
    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      throw new NotFoundException('Раунд не найден');
    }
    await this.ownedQuiz(user, round.quizId);
    await this.prisma.round.update({
      where: { id: roundId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.showLeaderboard !== undefined ? { showLeaderboard: dto.showLeaderboard } : {}),
        ...(dto.adId !== undefined ? { adId: dto.adId } : {}),
      },
    });
    return this.get(user, round.quizId);
  }

  async removeRound(user: AuthUser, roundId: string) {
    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      throw new NotFoundException('Раунд не найден');
    }
    await this.ownedQuiz(user, round.quizId);
    await this.prisma.round.delete({ where: { id: roundId } });
    return this.get(user, round.quizId);
  }

  async addQuestion(user: AuthUser, roundId: string, dto: { type?: 'SINGLE' | 'TRUE_FALSE' } = {}) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: { quiz: true },
    });
    if (!round) {
      throw new NotFoundException('Раунд не найден');
    }
    await this.ownedQuiz(user, round.quizId);
    const count = await this.prisma.question.count({ where: { roundId } });
    const type = dto.type === 'TRUE_FALSE' ? 'TRUE_FALSE' : 'SINGLE';
    const options =
      type === 'TRUE_FALSE'
        ? [
            { text: 'Правда', isCorrect: true, order: 1, color: OPTION_COLORS[0] },
            { text: 'Ложь', isCorrect: false, order: 2, color: OPTION_COLORS[1] },
          ]
        : OPTION_COLORS.map((color, i) => ({
            text: i === 0 ? 'Верный ответ' : `Вариант ${i + 1}`,
            isCorrect: i === 0,
            order: i + 1,
            color,
          }));
    await this.prisma.question.create({
      data: {
        roundId,
        text: type === 'TRUE_FALSE' ? 'Это правда?' : 'Новый вопрос',
        timeLimit: round.quiz.defaultQuestionTime,
        points: round.type === 'LIGHTNING' ? 1500 : 1000,
        order: count + 1,
        type,
        options: { create: options },
      },
    });
    return this.get(user, round.quizId);
  }

  async moveRound(user: AuthUser, roundId: string, direction: 'up' | 'down') {
    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      throw new NotFoundException('Раунд не найден');
    }
    await this.ownedQuiz(user, round.quizId);
    const rounds = await this.prisma.round.findMany({
      where: { quizId: round.quizId },
      orderBy: { order: 'asc' },
    });
    const index = rounds.findIndex((r) => r.id === roundId);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= rounds.length) {
      return this.get(user, round.quizId);
    }
    const other = rounds[swapWith];
    await this.prisma.$transaction([
      this.prisma.round.update({ where: { id: round.id }, data: { order: other.order } }),
      this.prisma.round.update({ where: { id: other.id }, data: { order: round.order } }),
    ]);
    return this.get(user, round.quizId);
  }

  async updateQuestion(
    user: AuthUser,
    questionId: string,
    dto: {
      text?: string;
      hint?: string | null;
      timeLimit?: number;
      points?: number;
      type?: 'SINGLE' | 'TRUE_FALSE';
      options?: { id?: string; text: string; isCorrect: boolean; color?: string }[];
    },
  ) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { round: true },
    });
    if (!question) {
      throw new NotFoundException('Вопрос не найден');
    }
    await this.ownedQuiz(user, question.round.quizId);

    if (dto.options) {
      if (dto.options.length < 2 || dto.options.length > 4) {
        throw new BadRequestException('Вариантов должно быть от 2 до 4');
      }
      if (!dto.options.some((o) => o.isCorrect)) {
        throw new BadRequestException('Отметь верный вариант');
      }
      await this.prisma.questionOption.deleteMany({ where: { questionId } });
      await this.prisma.questionOption.createMany({
        data: dto.options.map((o, i) => ({
          questionId,
          text: o.text.trim() || `Вариант ${i + 1}`,
          isCorrect: o.isCorrect,
          order: i + 1,
          color: o.color || OPTION_COLORS[i % OPTION_COLORS.length],
        })),
      });
    }

    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        ...(dto.text !== undefined ? { text: dto.text } : {}),
        ...(dto.hint !== undefined ? { hint: dto.hint?.trim() || null } : {}),
        ...(dto.timeLimit !== undefined ? { timeLimit: dto.timeLimit } : {}),
        ...(dto.points !== undefined ? { points: dto.points } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
      },
    });
    return this.get(user, question.round.quizId);
  }

  async removeQuestion(user: AuthUser, questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { round: true },
    });
    if (!question) {
      throw new NotFoundException('Вопрос не найден');
    }
    await this.ownedQuiz(user, question.round.quizId);
    await this.prisma.question.delete({ where: { id: questionId } });
    return this.get(user, question.round.quizId);
  }

  ads(user: AuthUser) {
    return this.prisma.ad.findMany({
      where: user.role === 'ADMIN' ? {} : { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAd(
    user: AuthUser,
    dto: { title: string; body?: string; mediaUrl?: string; durationSec?: number; cta?: string },
  ) {
    await this.assertHost(user);
    return this.prisma.ad.create({
      data: {
        ownerId: user.id,
        title: (dto.title || 'Реклама').trim(),
        body: dto.body?.trim() || 'Пауза на рекламу',
        mediaUrl: dto.mediaUrl?.trim() || '',
        durationSec: Math.max(Number(dto.durationSec) || 14, 12),
        cta: dto.cta?.trim() || null,
        type: 'IMAGE',
      },
    });
  }

  async updateAd(
    user: AuthUser,
    adId: string,
    dto: { title?: string; body?: string; mediaUrl?: string; durationSec?: number; cta?: string },
  ) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || (ad.ownerId !== user.id && user.role !== 'ADMIN')) {
      throw new ForbiddenException('Нет доступа к рекламе');
    }
    return this.prisma.ad.update({
      where: { id: adId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl } : {}),
        ...(dto.durationSec !== undefined ? { durationSec: dto.durationSec } : {}),
        ...(dto.cta !== undefined ? { cta: dto.cta } : {}),
      },
    });
  }

  async removeAd(user: AuthUser, adId: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || (ad.ownerId !== user.id && user.role !== 'ADMIN')) {
      throw new ForbiddenException('Нет доступа к рекламе');
    }
    await this.prisma.ad.delete({ where: { id: adId } });
    return { ok: true };
  }
}
