import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHmac, randomInt, randomBytes } from 'crypto';

import { StudentService } from '../student/student.service';
import { EmployeeService } from '../employee/employee.service';
import { AdminService } from '../admin/admin.service';
import { MailService } from '../mail/mail.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { SessionService } from './session/session.service';
import type { UserType } from './session/session.schema';

import {
  StudentLoginDto,
  EmployeeLoginDto,
  AdminLoginDto,
  RegisterStudentDto,
  VerifyEmailDto,
  ResendCodeDto,
} from './dto/auth.dto';

import {
  LogoutResponse,
  SessionAuthResponse,
  SessionRequestContext,
} from './interfaces/auth.interface';

import { AUTH_ERROR_MESSAGES } from './constants/auth.constants';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { StudentStatus } from '../student/schemas/student.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly SALT_ROUNDS = 12;
  private readonly CODE_EXPIRY_MINUTES = 15;
  private readonly MAX_VERIFY_ATTEMPTS = 5;
  private readonly RESEND_COOLDOWN_MS = 60_000;

  private readonly INSTITUTIONAL_DOMAINS = [
    'edu.br',
    'ac.br',
    'usp.br',
    'unicamp.br',
    'ufrj.br',
    'unifesp.br',
  ];

  constructor(
    private readonly studentService: StudentService,
    private readonly employeeService: EmployeeService,
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly auditLog: AuditLogService,
    private readonly sessionService: SessionService,
  ) {}

  private getDocumentId(document: unknown): string {
    return (document as { _id: { toString(): string } })._id.toString();
  }

  private hashCpf(cpf: string): string {
    const secret = this.configService.getOrThrow<string>('CPF_HMAC_SECRET');
    return createHmac('sha256', secret).update(cpf).digest('hex');
  }

  private isValidCpf(cpf: string): boolean {
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    const calc = (digits: string, weights: number[]) => {
      const sum = digits
        .split('')
        .reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
      const rem = sum % 11;
      return rem < 2 ? 0 : 11 - rem;
    };
    const d1 = calc(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    if (d1 !== parseInt(cpf[9], 10)) return false;
    const d2 = calc(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d2 === parseInt(cpf[10], 10);
  }

  async registerStudent(
    dto: RegisterStudentDto,
  ): Promise<{ message: string; isInstitutional: boolean }> {
    if (!this.isValidCpf(dto.cpf)) {
      throw new BadRequestException('CPF inválido');
    }

    const cpfHash = this.hashCpf(dto.cpf);

    const [existingEmail, existingCpf] = await Promise.all([
      this.studentService.findByEmail(dto.email),
      this.studentService.findByCpfHash(cpfHash),
    ]);

    if (existingEmail) {
      await this.auditLog.record({
        action: 'register.student.exists',
        outcome: 'failure',
        target: { email: dto.email },
        metadata: { reason: 'email_exists' },
      });
      throw new ConflictException('Dados já cadastrados no sistema');
    }

    if (existingCpf) {
      await this.auditLog.record({
        action: 'register.student.exists',
        outcome: 'failure',
        target: { email: dto.email },
        metadata: { reason: 'cpf_exists' },
      });
      throw new ConflictException('Dados já cadastrados no sistema');
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const isInstitutional = this.isInstitutionalEmail(dto.email);
    const { code, codeHash, expiresAt } = await this.generateVerificationCode();

    this.logger.debug(`[DEV ONLY] Verification code for ${dto.email}: ${code}`);

    await this.studentService.create({
      name: dto.name,
      email: dto.email,
      cpfHash,
      password: hashedPassword,
      telephone: dto.telephone,
      status: StudentStatus.PENDING,
      isInstitutionalEmail: isInstitutional,
      verificationCode: codeHash,
      verificationCodeExpiresAt: expiresAt,
      verificationCodeAttempts: 0,
      verificationCodeLockedUntil: null,
      verificationCodeLastSentAt: new Date(),
    });

    await this.mailService.sendVerificationCode(dto.email, code, isInstitutional);

    await this.auditLog.record({
      action: 'register.student',
      outcome: 'success',
      target: { email: dto.email },
      metadata: { institutional: isInstitutional },
    });

    return {
      message: 'Código de verificação enviado para o seu e-mail',
      isInstitutional,
    };
  }

  async verifyStudentEmail(
    dto: VerifyEmailDto,
    context: SessionRequestContext,
  ): Promise<SessionAuthResponse> {
    const student = await this.studentService.findByEmailWithSensitiveFields(dto.email);
    const invalidMessage = AUTH_ERROR_MESSAGES.INVALID_CODE;

    if (!student) {
      await this.auditLog.record({
        action: 'verify_email',
        outcome: 'failure',
        target: { email: dto.email },
        metadata: { reason: 'email_not_found' },
      });
      throw new UnauthorizedException(invalidMessage);
    }

    if (student.status === StudentStatus.ACTIVE) {
      throw new BadRequestException(AUTH_ERROR_MESSAGES.ACCOUNT_ALREADY_ACTIVE);
    }

    if (
      student.verificationCodeLockedUntil &&
      student.verificationCodeLockedUntil > new Date()
    ) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.EXPIRED_CODE);
    }

    if (!student.verificationCode || !student.verificationCodeExpiresAt) {
      throw new UnauthorizedException(invalidMessage);
    }

    if (student.verificationCodeExpiresAt < new Date()) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.EXPIRED_CODE);
    }

    const [salt, storedHash] = student.verificationCode.split(':');
    const isMatch =
      Boolean(salt && storedHash) &&
      (await bcrypt.compare(dto.code + salt, storedHash));

    if (!isMatch) {
      const attempts = (student.verificationCodeAttempts ?? 0) + 1;
      const lockedUntil =
        attempts >= this.MAX_VERIFY_ATTEMPTS
          ? new Date(Date.now() + this.RESEND_COOLDOWN_MS)
          : null;

      await this.studentService.recordVerificationFailure(
        this.getDocumentId(student),
        attempts,
        lockedUntil,
      );

      await this.auditLog.record({
        action: 'verify_email',
        outcome: 'failure',
        target: { email: dto.email },
        metadata: { reason: 'invalid_code', attempts },
      });

      throw new UnauthorizedException(invalidMessage);
    }

    const studentId = this.getDocumentId(student);

    await this.studentService.activate(studentId);

    await this.auditLog.record({
      action: 'student.verify',
      outcome: 'success',
      actor: {
        id: studentId,
        role: UserRole.STUDENT,
        identifier: student.email,
      },
    });

    return this.createSessionResponse(
      studentId,
      UserRole.STUDENT,
      student.email,
      student.name,
      context,
    );
  }

  async resendVerificationCode(dto: ResendCodeDto): Promise<{ message: string }> {
    const student = await this.studentService.findByEmailWithSensitiveFields(dto.email);

    const genericMessage = {
      message: 'Se o email estiver cadastrado e pendente, um novo código de verificação foi enviado',
    };

    if (!student || student.status === StudentStatus.ACTIVE) {
      return genericMessage;
    }

    const lastSent = student.verificationCodeLastSentAt?.getTime?.() ?? 0;
    if (lastSent && Date.now() - lastSent < this.RESEND_COOLDOWN_MS) {
      return genericMessage;
    }

    const { code, codeHash, expiresAt } = await this.generateVerificationCode();

    await this.studentService.updateVerificationCode(
      this.getDocumentId(student),
      codeHash,
      expiresAt,
      new Date(),
    );

    await this.mailService.sendVerificationCode(
      student.email,
      code,
      student.isInstitutionalEmail,
    );

    await this.auditLog.record({
      action: 'resend_verification_code',
      outcome: 'success',
      actor: {
        id: this.getDocumentId(student),
        role: UserRole.STUDENT,
        identifier: student.email,
      },
    });

    return genericMessage;
  }

  async loginStudent(
    dto: StudentLoginDto,
    context: SessionRequestContext,
  ): Promise<SessionAuthResponse> {
    const student = await this.studentService.findByEmailWithSensitiveFields(dto.email);

    const passwordToCompare =
      student?.password ?? '$2b$12$invalidhashfortimingattackprevention';
    const isValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!student || !isValid) {
      await this.auditLog.record({
        action: 'student.login',
        outcome: 'failure',
        target: { email: dto.email },
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    if (student.status !== StudentStatus.ACTIVE) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_PENDING);
    }

    const studentId = this.getDocumentId(student);

    await this.auditLog.record({
      action: 'student.login',
      outcome: 'success',
      actor: {
        id: studentId,
        role: UserRole.STUDENT,
        identifier: student.email,
      },
    });

    return this.createSessionResponse(
      studentId,
      UserRole.STUDENT,
      student.email,
      student.name,
      context,
    );
  }

  async loginEmployee(
    dto: EmployeeLoginDto,
    context: SessionRequestContext,
  ): Promise<SessionAuthResponse> {
    const employee = await this.employeeService.findByRegistrationIdWithPassword(
      dto.registrationId,
    );

    const passwordToCompare =
      employee?.password ?? '$2b$12$invalidhashfortimingattackprevention';
    const isValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!employee || !isValid || !employee.active) {
      await this.auditLog.record({
        action: 'employee.login',
        outcome: 'failure',
        target: { registrationId: dto.registrationId },
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const employeeId = this.getDocumentId(employee);

    await this.auditLog.record({
      action: 'employee.login',
      outcome: 'success',
      actor: {
        id: employeeId,
        role: UserRole.EMPLOYEE,
        identifier: employee.registrationId,
      },
    });

    return this.createSessionResponse(
      employeeId,
      UserRole.EMPLOYEE,
      employee.registrationId,
      employee.name,
      context,
    );
  }

  async loginAdmin(
    dto: AdminLoginDto,
    context: SessionRequestContext,
  ): Promise<SessionAuthResponse> {
    const admin = await this.adminService.findByUsernameWithPassword(dto.username);

    const passwordToCompare =
      admin?.password ?? '$2b$12$invalidhashfortimingattackprevention';
    const isValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!admin || !isValid) {
      await this.auditLog.record({
        action: 'admin.login',
        outcome: 'failure',
        target: { username: dto.username },
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const adminId = this.getDocumentId(admin);

    await this.auditLog.record({
      action: 'admin.login',
      outcome: 'success',
      actor: {
        id: adminId,
        role: UserRole.ADMIN,
        identifier: admin.username,
      },
    });

    return this.createSessionResponse(
      adminId,
      UserRole.ADMIN,
      admin.username,
      admin.username,
      context,
    );
  }

  async logout(sessionId?: string): Promise<LogoutResponse> {
    if (sessionId) {
      try {
        await this.sessionService.revokeSession(sessionId);
      } catch (error) {
        this.logger.warn(
          `Logout idempotente: não foi possível revogar sessão ${sessionId}: ${(error as Error).message}`,
        );
      }
    }

    await this.auditLog.record({
      action: 'logout',
      outcome: 'success',
      metadata: { sessionIdProvided: Boolean(sessionId) },
    });

    return { ok: true };
  }

  private async createSessionResponse(
    userId: string,
    userType: UserType,
    identifier: string,
    name: string,
    context: SessionRequestContext,
  ): Promise<SessionAuthResponse> {
    const session = await this.sessionService.createSession(userId, userType, context);

    return {
      ok: true,
      sessionId: session.sessionId,
      user: {
        id: userId,
        role: userType as UserRole,
        identifier,
        name,
      },
    };
  }

  private isInstitutionalEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return this.INSTITUTIONAL_DOMAINS.some(
      (inst) => domain === inst || domain.endsWith('.' + inst),
    );
  }

  private async generateVerificationCode(): Promise<{
    code: string;
    codeHash: string;
    expiresAt: Date;
  }> {
    const code = String(randomInt(100_000, 1_000_000));
    const salt = randomBytes(16).toString('hex');
    const hashedCode = await bcrypt.hash(code + salt, 10);
    const codeHash = `${salt}:${hashedCode}`;
    const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);
    return { code, codeHash, expiresAt };
  }
}
