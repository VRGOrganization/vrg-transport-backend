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

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f0f2f0;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f0;padding:28px 12px">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #ccc">

    <!-- topo verde -->
    <tr><td style="background:#2d6a2d;height:6px;font-size:0">&nbsp;</td></tr>

    <!-- header com logo -->
    <tr><td style="padding:20px 32px 16px;border-bottom:1px solid #e0e0e0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle">
            <img src="https://saofidelis.rj.gov.br/wp-content/uploads/2025/03/PREFEITURA-HORIZONTAL-2.png"
                 alt="Prefeitura de São Fidélis" height="64"
                 style="display:block;height:64px;width:auto"/>
          </td>
          <td style="width:1px;background:#d0d0d0;padding:0 20px;vertical-align:middle">
            <div style="width:1px;height:50px;background:#d0d0d0"></div>
          </td>
          <td style="text-align:right;vertical-align:middle">
            <div style="color:#999;font-size:9px;letter-spacing:1px;text-transform:uppercase">Sistema municipal</div>
            <div style="color:#2d6a2d;font-size:13px;font-weight:700;margin-top:2px">VRG Transport</div>
            <div style="color:#888;font-size:10px;margin-top:1px">Transporte Estudantil</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- barra verde com secretaria -->
    <tr><td style="background:#2d6a2d;padding:9px 32px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#fff;font-size:11px;letter-spacing:0.5px">Secretaria Municipal de Transporte e Mobilidade Urbana</td>
          <td style="text-align:right">
            <span style="background:#1a4a1a;border:1px solid #4a9a4a;padding:3px 10px;color:#90d090;font-size:10px;letter-spacing:0.8px;text-transform:uppercase">E-mail seguro</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- saudação e intro -->
    <tr><td style="padding:32px 40px 0">
      <p style="font-size:15px;color:#222;font-weight:700;margin:0 0 6px">Olá, ${name}</p>
      <p style="font-size:13px;color:#555;line-height:1.7;margin:0 0 26px">
        Sua solicitação de cadastro no <strong>Sistema de Transporte Estudantil de São Fidélis</strong>
        foi recebida. Para confirmar sua identidade e ativar o acesso, utilize o código abaixo dentro do prazo indicado.
      </p>
    </td></tr>

    ${institutionalNote}

    <!-- caixa OTP -->
    <tr><td style="padding:0 40px 24px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2d6a2d">
        <tr><td style="background:#2d6a2d;padding:10px 20px">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:8px;height:8px;background:#90d090;border-radius:50%;font-size:0">&nbsp;</td>
              <td style="color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;padding-left:8px">Código de verificação único (OTP)</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#f9fdf9;padding:24px 20px;text-align:center">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px">
            <tr>
              ${digits.map(d => `
              <td style="width:52px;height:64px;background:#fff;border:2px solid #2d6a2d;text-align:center;vertical-align:middle;font-size:28px;font-weight:700;color:#1a4a1a;font-family:'Courier New',monospace;margin:0 3px;padding:0 3px">
                ${d}
              </td>`).join('')}
            </tr>
          </table>
          <div style="display:inline-block;background:#e8f5e8;border:1px solid #b0d8b0;padding:5px 14px">
            <span style="font-size:12px;color:#2d6a2d;font-weight:700">Válido por 15 minutos</span>
            <span style="font-size:11px;color:#5a8a5a"> · Não compartilhe</span>
          </div>
        </td></tr>
      </table>
    </td></tr>

    <!-- alerta -->
    <tr><td style="padding:0 40px 20px">
      <div style="border-left:4px solid #e8a000;background:#fffbf0;padding:12px 16px">
        <div style="color:#9a6a00;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:5px">Atenção — Segurança</div>
        <div style="color:#7a5500;font-size:12px;line-height:1.6">
          A Prefeitura de São Fidélis e o sistema VRG Transport <strong>nunca solicitam seu código por telefone, WhatsApp ou e-mail</strong>.
          Se alguém pedir, recuse e denuncie pelo (22) 2758-1082.
        </div>
      </div>
    </td></tr>

    <!-- passo a passo -->
    <tr><td style="padding:0 40px 20px">
      <div style="font-size:12px;font-weight:700;color:#2d6a2d;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e8f5e8">Como usar o código</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding-bottom:8px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:20px;height:20px;background:#2d6a2d;color:#fff;font-size:11px;font-weight:700;text-align:center;vertical-align:middle;border-radius:50%;flex-shrink:0">1</td>
            <td style="font-size:13px;color:#444;line-height:1.5;padding-left:12px">Acesse o portal <strong>VRG Transport</strong> ou o aplicativo municipal no seu dispositivo.</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding-bottom:8px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:20px;height:20px;background:#2d6a2d;color:#fff;font-size:11px;font-weight:700;text-align:center;vertical-align:middle;border-radius:50%">2</td>
            <td style="font-size:13px;color:#444;line-height:1.5;padding-left:12px">Na tela de verificação, insira os <strong>6 dígitos</strong> exibidos acima exatamente como mostrado.</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding-bottom:8px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:20px;height:20px;background:#2d6a2d;color:#fff;font-size:11px;font-weight:700;text-align:center;vertical-align:middle;border-radius:50%">3</td>
            <td style="font-size:13px;color:#444;line-height:1.5;padding-left:12px">Após confirmar, sua <strong>Carteirinha Digital Estudantil</strong> será emitida e ficará disponível no sistema.</td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>

    <!-- nota de ignorar -->
    <tr><td style="padding:0 40px 32px">
      <div style="background:#f5f5f5;border:1px solid #e0e0e0;padding:10px 14px;font-size:11px;color:#888;line-height:1.6">
        Caso não tenha solicitado o cadastro, ignore este e-mail com segurança. Nenhuma ação será realizada e seus dados não serão armazenados.
      </div>
    </td></tr>

    <!-- faixa dourada -->
    <tr><td style="background:#d4a017;height:3px;font-size:0">&nbsp;</td></tr>

    <!-- footer -->
    <tr><td style="background:#2d6a2d;padding:18px 32px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #3d8a3d;padding-bottom:14px;margin-bottom:12px">
        <tr>
          <td style="color:#c0e8c0;font-size:11px;line-height:1.8;vertical-align:top">
            <strong style="color:#fff;font-size:13px;display:block;margin-bottom:3px">Prefeitura Municipal de São Fidélis</strong>
            Secretaria de Transporte e Mobilidade Urbana<br>
            Pç. São Fidélis, 151 — Centro · São Fidélis/RJ<br>
            Sistema VRG Transport — Carteirinha Digital
          </td>
          <td style="text-align:right;color:#c0e8c0;font-size:11px;line-height:1.8;vertical-align:top">
            <strong style="color:#fff">Suporte</strong><br>
            transporte@saofidelis.rj.gov.br<br>
            (22) 2758-1082<br>
            Seg–Sex · 08h às 17h30
          </td>
        </tr>
      </table>
      <p style="font-size:10px;color:#90c890;text-align:center;line-height:1.6;margin:0">
        Este é um e-mail automático. Por favor, não responda a esta mensagem. · saofidelis.rj.gov.br<br>
        © 2026 Prefeitura Municipal de São Fidélis · Todos os direitos reservados
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.configService.get('MAIL_FROM_NAME', 'Prefeitura de São Fidélis'),
          email: this.configService.getOrThrow<string>('MAIL_FROM_ADDRESS'),
        },
        to: [{ email: to }],
        htmlContent,
      });
      this.logger.log(`Código de verificação enviado para ${to}`);
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail para ${to}`, error);
      throw error;
    }
  }
}