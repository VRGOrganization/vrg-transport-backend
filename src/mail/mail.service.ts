import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';
import { PhotoType } from '../image/types/photoType.enum';

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

  async sendLicenseRejection(
    to: string,
    studentName: string,
    reason: string,
  ): Promise<void> {
    const name = studentName ?? 'Estudante';

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        subject: 'Sua solicitação de carteirinha foi recusada',
        sender: {
          name: this.configService.get('MAIL_FROM_NAME', 'VRG Transport'),
          email: this.configService.getOrThrow<string>('MAIL_FROM_ADDRESS'),
        },
        to: [{ email: to }],
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#991b1b">Solicitação recusada</h2>
            <p>Olá, <strong>${name}</strong>.</p>
            <p>Infelizmente sua solicitação de carteirinha de transporte foi <strong>recusada</strong> pelo seguinte motivo:</p>
            <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:4px;margin:16px 0">
              <p style="color:#991b1b;font-weight:600;margin:0">${reason}</p>
            </div>
            <p>Para solicitar novamente, acesse o aplicativo e passe pelo processo de solicitação completo.</p>
            <p style="color:#6b7280;font-size:13px;margin-top:16px">
              Em caso de dúvidas, entre em contato com a secretaria municipal de transportes.
            </p>
          </div>
        `,
      });
      this.logger.log(`Email de recusa enviado para ${to}`);
    } catch (error) {
      this.logger.error(`Falha ao enviar email de recusa para ${to}`, error);
      throw error;
    }
  }

  async sendDocumentUpdateRejected(
    email: string,
    name: string,
    reason: string,
  ): Promise<void> {
    const studentName = name ?? 'Estudante';

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        subject: 'Sua solicitação de alteração de documentos foi recusada',
        sender: {
          name: this.configService.get('MAIL_FROM_NAME', 'VRG Transport'),
          email: this.configService.getOrThrow<string>('MAIL_FROM_ADDRESS'),
        },
        to: [{ email }],
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#991b1b">Solicitação de alteração recusada</h2>
            <p>Olá, <strong>${studentName}</strong>.</p>
            <p>Sua solicitação de <strong>alteração de documentos</strong> foi recusada pelo seguinte motivo:</p>
            <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:4px;margin:16px 0">
              <p style="color:#991b1b;font-weight:600;margin:0">${reason}</p>
            </div>
            <p>Você pode reenviar uma nova solicitação com os documentos corrigidos.</p>
            <p style="color:#6b7280;font-size:13px;margin-top:16px">
              Em caso de dúvidas, entre em contato com a secretaria municipal de transportes.
            </p>
          </div>
        `,
      });
      this.logger.log(`Email de recusa de alteração de documentos enviado para ${email}`);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar email de recusa de alteração de documentos para ${email}`,
        error,
      );
      throw error;
    }
  }

  async sendDocumentUpdateApproved(
    email: string,
    name: string,
    changedDocuments: PhotoType[],
  ): Promise<void> {
    const studentName = name ?? 'Estudante';
    const labels: Record<PhotoType, string> = {
      [PhotoType.ProfilePhoto]: 'Foto 3x4',
      [PhotoType.EnrollmentProof]: 'Comprovante de matrícula',
      [PhotoType.CourseSchedule]: 'Grade horária',
      [PhotoType.LicenseImage]: 'Imagem da carteirinha',
      [PhotoType.GovernmentId]: 'Documento de identidade',
      [PhotoType.ProofOfResidence]: 'Comprovante de residência',
    };

    const listItems = changedDocuments
      .map((doc) => labels[doc] ?? doc)
      .map((doc) => `<li style="margin:6px 0">${doc}</li>`)
      .join('');

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        subject: 'Sua solicitação de alteração de documentos foi aprovada',
        sender: {
          name: this.configService.get('MAIL_FROM_NAME', 'VRG Transport'),
          email: this.configService.getOrThrow<string>('MAIL_FROM_ADDRESS'),
        },
        to: [{ email }],
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1b4332">Solicitação aprovada</h2>
            <p>Olá, <strong>${studentName}</strong>.</p>
            <p>Sua solicitação de alteração de documentos foi <strong>aprovada</strong>.</p>
            <p>Documentos atualizados:</p>
            <ul style="padding-left:20px;margin:8px 0 16px">
              ${listItems || '<li>Nenhum documento informado</li>'}
            </ul>
            <p>Sua carteirinha foi gerada novamente com os dados atualizados.</p>
            <p style="color:#6b7280;font-size:13px;margin-top:16px">
              Em caso de dúvidas, entre em contato com a secretaria municipal de transportes.
            </p>
          </div>
        `,
      });
      this.logger.log(`Email de aprovação de alteração de documentos enviado para ${email}`);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar email de aprovação de alteração de documentos para ${email}`,
        error,
      );
      throw error;
    }
  }

  async sendWaitlistConfirmation(
    email: string,
    name: string,
    filaPosition: number,
  ): Promise<void> {
    const studentName = name ?? 'Estudante';

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        subject: 'Solicitação recebida em fila de espera',
        sender: {
          name: this.configService.get('MAIL_FROM_NAME', 'VRG Transport'),
          email: this.configService.getOrThrow<string>('MAIL_FROM_ADDRESS'),
        },
        to: [{ email }],
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1d4ed8">Fila de espera confirmada</h2>
            <p>Olá, <strong>${studentName}</strong>.</p>
            <p>Sua solicitação foi recebida, mas no momento todas as vagas estão preenchidas.</p>
            <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:16px;border-radius:4px;margin:16px 0">
              <p style="color:#1e3a8a;font-weight:600;margin:0">Posição atual na fila: ${filaPosition}</p>
            </div>
            <p>Assim que houver liberação de vaga, você será notificado.</p>
          </div>
        `,
      });
      this.logger.log(`Email de confirmacao de fila enviado para ${email}`);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar email de confirmacao de fila para ${email}`,
        error,
      );
      throw error;
    }
  }

  async sendWaitlistPromotion(email: string, name: string): Promise<void> {
    const studentName = name ?? 'Estudante';

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        subject: 'Sua solicitação saiu da fila de espera',
        sender: {
          name: this.configService.get('MAIL_FROM_NAME', 'VRG Transport'),
          email: this.configService.getOrThrow<string>('MAIL_FROM_ADDRESS'),
        },
        to: [{ email }],
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#166534">Vaga liberada para sua solicitação</h2>
            <p>Olá, <strong>${studentName}</strong>.</p>
            <p>Boa notícia! Sua solicitação foi promovida da fila de espera e voltou para análise.</p>
            <p>Em breve ela será avaliada pela equipe responsável.</p>
          </div>
        `,
      });
      this.logger.log(`Email de promocao de fila enviado para ${email}`);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar email de promocao de fila para ${email}`,
        error,
      );
      throw error;
    }
  }

  async sendPasswordResetEmail(
    to: string,
    studentName: string,
    resetLink: string,
  ): Promise<void> {
    const name = studentName ?? 'Estudante';

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        subject: 'Redefinir sua senha — São Fidélis Transporte',
        sender: {
          name: this.configService.get('MAIL_FROM_NAME', 'VRG Transport'),
          email: this.configService.getOrThrow<string>('MAIL_FROM_ADDRESS'),
        },
        to: [{ email: to }],
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1b4332">Redefinir sua senha</h2>
            <p>Olá, <strong>${name}</strong>.</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${resetLink}" style="display:inline-block;background:#1b4332;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
                Redefinir Senha
              </a>
            </div>
            <p style="color:#6b7280;font-size:13px;margin-top:16px">
              Este link expira em <strong>1 hora</strong>.<br>
              Se você não solicitou uma redefinição de senha, ignore este e-mail.
            </p>
          </div>
        `,
      });
      this.logger.log(`Email de redefinição de senha enviado para ${to}`);
    } catch (error) {
      this.logger.error(`Falha ao enviar email de redefinição de senha para ${to}`, error);
      throw error;
    }
  }
}
