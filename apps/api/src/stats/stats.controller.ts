import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ACHIEVEMENTS, parseAvatar } from '@quiz/shared';

@Controller()
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('leaderboard')
  async leaderboard() {
    const users = await this.prisma.user.findMany({
      where: { emailVerified: true, gamesPlayed: { gt: 0 } },
      orderBy: [{ rating: 'desc' }, { totalScore: 'desc' }],
      take: 50,
      include: { achievements: true },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.nickname || u.name,
      avatar: parseAvatar(u.avatar),
      rating: u.rating,
      wins: u.wins,
      gamesPlayed: u.gamesPlayed,
      medals: u.achievements.map((a) => a.achievementId),
    }));
  }

  @Get('achievements')
  catalog() {
    return ACHIEVEMENTS;
  }
}
