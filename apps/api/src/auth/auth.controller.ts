import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtGuard } from './jwt.guard';
import type { AuthUser } from './jwt.guard';
import { PushService } from '../push/push.service';
import type { AvatarConfig } from '@quiz/shared';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly push: PushService,
  ) {}

  @Post('register')
  register(@Body() body: { email: string; password: string; name: string }) {
    return this.auth.register(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body);
  }

  @Post('verify')
  verify(@Body() body: { token: string }) {
    return this.auth.verify(body.token);
  }

  @Get('verify')
  verifyGet(@Query('token') token: string) {
    return this.auth.verify(token);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Get('me/games')
  @UseGuards(JwtGuard)
  games(@CurrentUser() user: AuthUser) {
    return this.auth.games(user);
  }

  @Patch('me')
  @UseGuards(JwtGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Body() body: { name?: string; nickname?: string; avatar?: AvatarConfig },
  ) {
    return this.auth.updateMe(user, body);
  }

  @Post('resend')
  @UseGuards(JwtGuard)
  resend(@CurrentUser() user: AuthUser) {
    return this.auth.resend(user);
  }

  @Post('become-host')
  @UseGuards(JwtGuard)
  becomeHost(@CurrentUser() user: AuthUser) {
    return this.auth.becomeHost(user);
  }

  @Get('push/public-key')
  vapid() {
    return { publicKey: this.push.publicKey() };
  }

  @Post('push/subscribe')
  @UseGuards(JwtGuard)
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return this.push.subscribe(user.id, body);
  }
}
