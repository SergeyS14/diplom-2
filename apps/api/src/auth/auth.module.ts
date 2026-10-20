import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtGuard, OptionalJwtGuard } from './jwt.guard';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET') || 'quiz-diplom-dev-secret',
        signOptions: { expiresIn: '14d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtGuard, OptionalJwtGuard, MailService, PushService],
  exports: [AuthService, JwtGuard, OptionalJwtGuard, JwtModule, MailService, PushService],
})
export class AuthModule {}
