import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY') || '';
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY') || '';
    this.enabled = Boolean(publicKey && privateKey);
    if (this.enabled) {
      webpush.setVapidDetails(
        this.config.get('VAPID_SUBJECT') || 'mailto:quiz@localhost',
        publicKey,
        privateKey,
      );
    }
  }

  publicKey() {
    return this.config.get<string>('VAPID_PUBLIC_KEY') || '';
  }

  async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    await this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint: sub.endpoint } },
      create: {
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      update: {
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
    });
  }

  async sendVerify(userId: string, token: string) {
    if (!this.enabled) {
      return;
    }
    const url = this.mail.verifyUrl(token);
    const rows = await this.prisma.pushSubscription.findMany({ where: { userId } });
    const payload = JSON.stringify({
      title: 'Квиз',
      body: 'Нажми, чтобы подтвердить аккаунт',
      url: `/verify?token=${encodeURIComponent(token)}`,
    });
    for (const row of rows) {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
        );
      } catch (err) {
        this.logger.warn(`Push fail ${row.endpoint}: ${String(err)}`);
      }
    }
    this.logger.log(`Verify push (${rows.length}) url=${url}`);
  }
}
