import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StudioService } from './studio.service';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.guard';

@Controller('studio')
@UseGuards(JwtGuard)
export class StudioController {
  constructor(private readonly studio: StudioService) {}

  @Get('quizzes')
  list(@CurrentUser() user: AuthUser) {
    return this.studio.list(user);
  }

  @Post('quizzes')
  create(@CurrentUser() user: AuthUser, @Body() body: { title: string; description?: string }) {
    return this.studio.createQuiz(user, body);
  }

  @Get('quizzes/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.get(user, id);
  }

  @Patch('quizzes/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { title?: string; description?: string; defaultQuestionTime?: number; isPublished?: boolean },
  ) {
    return this.studio.updateQuiz(user, id, body);
  }

  @Delete('quizzes/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.removeQuiz(user, id);
  }

  @Post('quizzes/:id/rounds')
  addRound(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { title?: string }) {
    return this.studio.addRound(user, id, body);
  }

  @Patch('rounds/:id')
  updateRound(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      type?: 'STANDARD' | 'LIGHTNING' | 'FINAL';
      showLeaderboard?: boolean;
      adId?: string | null;
    },
  ) {
    return this.studio.updateRound(user, id, body);
  }

  @Delete('rounds/:id')
  removeRound(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.removeRound(user, id);
  }

  @Post('rounds/:id/questions')
  addQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { type?: 'SINGLE' | 'TRUE_FALSE' },
  ) {
    return this.studio.addQuestion(user, id, body);
  }

  @Post('rounds/:id/move')
  moveRound(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { direction: 'up' | 'down' },
  ) {
    return this.studio.moveRound(user, id, body.direction);
  }

  @Patch('questions/:id')
  updateQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: {
      text?: string;
      hint?: string | null;
      timeLimit?: number;
      points?: number;
      type?: 'SINGLE' | 'TRUE_FALSE';
      options?: { id?: string; text: string; isCorrect: boolean; color?: string }[];
    },
  ) {
    return this.studio.updateQuestion(user, id, body);
  }

  @Delete('questions/:id')
  removeQuestion(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.removeQuestion(user, id);
  }

  @Get('ads')
  ads(@CurrentUser() user: AuthUser) {
    return this.studio.ads(user);
  }

  @Post('ads')
  createAd(
    @CurrentUser() user: AuthUser,
    @Body() body: { title: string; body?: string; mediaUrl?: string; durationSec?: number; cta?: string },
  ) {
    return this.studio.createAd(user, body);
  }

  @Patch('ads/:id')
  updateAd(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { title?: string; body?: string; mediaUrl?: string; durationSec?: number; cta?: string },
  ) {
    return this.studio.updateAd(user, id, body);
  }

  @Delete('ads/:id')
  removeAd(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.studio.removeAd(user, id);
  }
}
