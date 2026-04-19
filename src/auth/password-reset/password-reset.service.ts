import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Types } from 'mongoose';

import { StudentService } from '../../student/student.service';
import { SessionService } from '../session/session.service';
import { MailService } from '../../mail/mail.service';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { getPasswordPolicyViolation } from '../../common/validators/password-policy';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly TOKEN_EXPIRY_HOURS = 1;

  constructor(
    private readonly studentService: StudentService,
    private readonly sessionService: SessionService,
    private readonly mailService: MailService,
    private readonly tokenRepository: PasswordResetTokenRepository,
    private readonly configService: ConfigService,
  ) {}

  async requestPasswordReset(email: string, ipAddress: string): Promise<void> {
    const student = await this.studentService.findByEmail(email);

    if (!student) {
      return;
    }

    const userId = new Types.ObjectId((student as any)._id);

    const tokenValue = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(tokenValue).digest('hex');
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.tokenRepository.create({
      userId,
      tokenHash,
      expiresAt,
      ip: ipAddress,
    });

    const resetLink = this.buildResetLink(tokenValue);

    this.logger.log(`Attempting to send password reset email to ${student.email}`);
    await this.mailService.sendPasswordResetEmail(student.email, student.name, resetLink);
    this.logger.log(`Password reset email sent successfully to ${student.email}`);
  }

  async resetPassword(tokenValue: string, newPassword: string): Promise<void> {
    // Valida a senha
    this.validatePassword(newPassword);

    // Calcula hash do token
    const tokenHash = createHash('sha256').update(tokenValue).digest('hex');

    // Busca o token
    const token = await this.tokenRepository.findByTokenHash(tokenHash);

    if (!token) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    // Valida as condições do token
    if (token.usedAt) {
      throw new BadRequestException('Este token já foi utilizado');
    }

    if (token.expiresAt < new Date()) {
      throw new BadRequestException('Token expirado');
    }

    // Obtém o student
    const student = await this.studentService.findById(token.userId.toString());
    if (!student) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Atualiza a senha
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.studentService.updatePassword((student as any)._id, hashedPassword);

    // Marca o token como usado
    await this.tokenRepository.markAsUsed((token as any)._id);

    // Invalida todas as sessões do usuário
    await this.sessionService.revokeAllSessions((student as any)._id.toString(), 'student');

    this.logger.log(`Password reset completed for student ${(student as any)._id}`);
  }

  private validatePassword(password: string): void {
    const violation = getPasswordPolicyViolation(password);
    if (violation) {
      throw new BadRequestException(violation);
    }
  }

  private buildResetLink(tokenValue: string): string {
    const configuredUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('BFF_STUDENT_URL');

    const baseUrl = configuredUrl?.trim();
    if (!baseUrl) {
      throw new Error(
        'Missing frontend URL configuration. Set FRONTEND_URL or BFF_STUDENT_URL.',
      );
    }

    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    return `${normalizedBaseUrl}/reset-password?token=${encodeURIComponent(tokenValue)}`;
  }
}
