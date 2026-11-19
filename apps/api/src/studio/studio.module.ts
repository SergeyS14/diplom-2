import { Module } from '@nestjs/common';
import { StudioController } from './studio.controller';
import { GameModule } from '../game/game.module';
import { StudioService } from './studio.service';

@Module({
  imports: [GameModule],
  controllers: [StudioController],
  providers: [StudioService],
})
export class StudioModule {}
