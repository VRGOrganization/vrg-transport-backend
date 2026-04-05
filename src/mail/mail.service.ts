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
    studentName?: string,
  ): Promise<void> {
    const subject = isInstitutional
      ? 'Código de verificação — Pré-validação institucional'
      : 'Código de verificação da sua conta';

    const name = studentName ?? 'Estudante';
    const digits = code.split('');

    const institutionalNote = isInstitutional
      ? `<tr><td style="padding:0 40px 20px">
           <div style="border-left:4px solid #d4a017;background:#fffbf0;padding:12px 16px">
             <div style="color:#9a6a00;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:5px">Pré-validação institucional</div>
             <div style="color:#7a5500;font-size:12px;line-height:1.6">
               <strong>E-mail institucional detectado.</strong> Sua conta será pré-validada como estudante vinculado a uma instituição de ensino.
             </div>
           </div>
         </td></tr>`
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
