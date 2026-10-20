import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST') || 'localhost',
      port: Number(this.config.get('SMTP_PORT') || 1025),
      secure: false,
    });
  }

  verifyUrl(token: string) {
    const base = this.config.get('PLAYER_URL') || 'http://localhost:5174';
    return `${base}/verify?token=${encodeURIComponent(token)}`;
  }

  async sendVerifyEmail(to: string, token: string) {
    const url = this.verifyUrl(token);
    const html = `
      <div style="font-family:sans-serif;max-width:480px">
        <h2>Квиз — подтверждение</h2>
        <p>Нажми кнопку, чтобы подтвердить аккаунт. Можно также открыть письмо в Mailhog.</p>
        <p><a href="${url}" style="background:#46178F;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none">Подтвердить</a></p>
        <p style="color:#666;font-size:12px">${url}</p>
      </div>`;
    try {
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM') || 'quiz@localhost',
        to,
        subject: 'Подтверди аккаунт в квизе',
        html,
      });
      this.logger.log(`Verify mail → ${to}`);
    } catch (err) {
      this.logger.warn(`Почта недоступна, ссылка для ${to}: ${url}`);
      this.logger.warn(String(err));
    }
    return url;
  }
}
