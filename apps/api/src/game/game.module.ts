import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Module({
  imports: [AuthModule],
  exports: [GameService],
  providers: [GameGateway, GameService],
})
export class GameModule {}
