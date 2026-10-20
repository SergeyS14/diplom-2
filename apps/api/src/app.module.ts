import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { GameModule } from './game/game.module';
import { AuthModule } from './auth/auth.module';
import { StudioModule } from './studio/studio.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    HealthModule,
    QuizzesModule,
    StudioModule,
    StatsModule,
    GameModule,
  ],
})
export class AppModule {}
