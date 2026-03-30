/* import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT', 587),
      secure: this.configService.get<boolean>('MAIL_SECURE', false),
      auth: {
        user: this.configService.getOrThrow<string>('MAIL_USER'),
        pass: this.configService.getOrThrow<string>('MAIL_PASS'),
      },
    });
  }

  async sendVerificationCode(
    to: string,
    code: string,
    isInstitutional: boolean,
  ): Promise<void> {
    const subject = isInstitutional
      ? 'Código de verificação — Pré-validação institucional'
      : 'Código de verificação da sua conta';

    const institutionalNote = isInstitutional
      ? `<p style="color:#2d6a4f;background:#d8f3dc;padding:12px;border-radius:6px;">
           <strong>E-mail institucional detectado.</strong> Sua conta será pré-validada como estudante vinculado a uma instituição de ensino.
         </p>`
      : '';

    await this.transporter.sendMail({
      from: `"${this.configService.get('MAIL_FROM_NAME', 'VRG Transport')}" <${this.configService.get('MAIL_USER')}>`,
      to,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1b4332">Confirme seu e-mail</h2>
          ${institutionalNote}
          <p>Seu código de verificação é:</p>
          <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1b4332;background:#f0fdf4;padding:20px;border-radius:8px;text-align:center">
            ${code}
          </div>
          <p style="color:#6b7280;font-size:13px;margin-top:16px">
            Este código expira em <strong>15 minutos</strong>.<br>
            Se você não criou uma conta, ignore este e-mail.
          </p>
        </div>
      `,
    });

    this.logger.log(`Código de verificação enviado para ${to}`);
  }
} */



import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private readonly configService: ConfigService,
  ) {
     if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new Error('MailService stub não pode rodar em produção');
    }
  }
  private readonly logger = new Logger(MailService.name);

  async sendVerificationCode(
    to: string,
    code: string,
    isInstitutional: boolean,
  ): Promise<void> {
    this.logger.log(
      `[DEV] Código para ${to}: ${code} (institucional: ${isInstitutional})`,
    );
  }
}