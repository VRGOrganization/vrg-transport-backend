import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: BrevoClient;

  constructor(private readonly configService: ConfigService) {
    this.client = new BrevoClient({
      apiKey: this.configService.getOrThrow<string>('BREVO_API_KEY'),
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

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.configService.get('MAIL_FROM_NAME', 'VRG Transport'),
          email: this.configService.getOrThrow<string>('MAIL_FROM_ADDRESS'),
        },
        to: [{ email: to }],
        htmlContent: `
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
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail para ${to}`, error);
      throw error;
    }
  }
}
