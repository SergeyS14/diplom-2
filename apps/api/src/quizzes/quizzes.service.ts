import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished() {
    const quizzes = await this.prisma.quiz.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      include: {
        rounds: {
          orderBy: { order: 'asc' },
          select: { id: true, title: true, _count: { select: { questions: true } } },
        },
      },
    });
    return quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      coverUrl: q.coverUrl,
      defaultQuestionTime: q.defaultQuestionTime,
      rounds: q.rounds.length,
      questions: q.rounds.reduce((sum, r) => sum + r._count.questions, 0),
    }));
  }

  async getPublished(id: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id, isPublished: true },
      include: {
        rounds: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                text: true,
                mediaUrl: true,
                timeLimit: true,
                points: true,
                order: true,
                type: true,
                options: {
                  orderBy: { order: 'asc' },
                  select: { id: true, text: true, order: true, color: true },
                },
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Квиз не найден');
    }

    return quiz;
  }
}
