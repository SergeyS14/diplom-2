import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  ACHIEVEMENTS,
  parseAvatar,
  randomAvatar,
  type AvatarConfig,
  type GameHistoryItem,
  type PublicUser,
} from '@quiz/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';
import type { AuthUser } from './jwt.guard';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly push: PushService,
  ) {}

  async register(dto: { email: string; password: string; name: string }) {
    const email = dto.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new BadRequestException('Некорректный email');
    }
    if (dto.password.length < 6) {
      throw new BadRequestException('Пароль от 6 символов');
    }
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('Этот email уже зарегистрирован');
    }
    const token = randomUUID();
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name.trim().slice(0, 40) || 'Игрок',
        nickname: dto.name.trim().slice(0, 20),
        role: 'PLAYER',
        avatar: randomAvatar() as object,
        verifyToken: token,
        verifyTokenExp: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });
    const verifyUrl = await this.mail.sendVerifyEmail(user.email, token);
    return {
      accessToken: this.sign(user),
      user: await this.toPublic(user.id),
      verifyUrl,
    };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    return {
      accessToken: this.sign(user),
      user: await this.toPublic(user.id),
    };
  }

  async verify(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { verifyToken: token, verifyTokenExp: { gt: new Date() } },
    });
    if (!user) {
      throw new BadRequestException('Ссылка недействительна или истекла');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyToken: null, verifyTokenExp: null },
    });
    return {
      accessToken: this.sign(user),
      user: await this.toPublic(user.id),
    };
  }

  async resend(auth: AuthUser) {
    const token = randomUUID();
    await this.prisma.user.update({
      where: { id: auth.id },
      data: {
        verifyToken: token,
        verifyTokenExp: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.id } });
    const verifyUrl = await this.mail.sendVerifyEmail(user.email, token);
    await this.push.sendVerify(user.id, token);
    return { ok: true, verifyUrl };
  }

  async me(auth: AuthUser) {
    return this.toPublic(auth.id);
  }

  async games(auth: AuthUser): Promise<GameHistoryItem[]> {
    const rows = await this.prisma.gameResult.findMany({
      where: { userId: auth.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((row) => ({
      id: row.id,
      quizTitle: row.quizTitle,
      score: row.score,
      place: row.place,
      players: row.players,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async updateMe(
    auth: AuthUser,
    dto: { name?: string; nickname?: string; avatar?: AvatarConfig },
  ) {
    await this.prisma.user.update({
      where: { id: auth.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim().slice(0, 40) } : {}),
        ...(dto.nickname !== undefined ? { nickname: dto.nickname.trim().slice(0, 20) } : {}),
        ...(dto.avatar !== undefined ? { avatar: parseAvatar(dto.avatar) as object } : {}),
      },
    });
    return this.toPublic(auth.id);
  }

  async becomeHost(_auth: AuthUser) {
    throw new BadRequestException('Из аккаунта ведущим стать нельзя — показ запускается паролем на ТВ');
  }

  async toPublic(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { achievements: true },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      role: user.role,
      emailVerified: user.emailVerified,
      avatar: parseAvatar(user.avatar),
      rating: user.rating,
      gamesPlayed: user.gamesPlayed,
      wins: user.wins,
      podiums: user.podiums,
      totalScore: user.totalScore,
      bestScore: user.bestScore,
      correctAnswers: user.correctAnswers,
      bestStreak: user.bestStreak,
      medals: user.achievements.map((a) => a.achievementId),
    };
  }

  catalog() {
    return ACHIEVEMENTS;
  }

  private sign(user: { id: string; email: string; role: string }) {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
  }
}
