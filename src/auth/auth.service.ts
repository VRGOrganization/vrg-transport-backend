import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';

import { StudentService } from '../student/student.service';
import { EmployeeService } from '../employee/employee.service';
import { AdminService } from '../admin/admin.service';
import { MailService } from '../mail/mail.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { TokenService } from './services/token.service';
import { CookieService } from './services/cookie.service';

import {
  StudentLoginDto,
  EmployeeLoginDto,
  AdminLoginDto,
  RegisterStudentDto,
  VerifyEmailDto,
  ResendCodeDto,
} from './dto/auth.dto';

import {
  AuthenticatedUser,
  JwtPayload,
  LoginResponse,
  RefreshPayload,
  RefreshSession,
} from './interfaces/auth.interface';

import { AUTH_ERROR_MESSAGES } from './constants/auth.constants';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { StudentStatus } from '../student/schemas/student.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ─── Constantes de negócio ────────────────────────────────────────────────
  private readonly SALT_ROUNDS = 12;
  private readonly CODE_EXPIRY_MINUTES = 15;
  private readonly MAX_VERIFY_ATTEMPTS = 5;
  private readonly RESEND_COOLDOWN_MS = 60_000;

  // Domínios considerados institucionais
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
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════════════

  private hashCpf(cpf: string): string {
    const secret = this.configService.getOrThrow<string>('CPF_HMAC_SECRET');
    return createHmac('sha256', secret).update(cpf).digest('hex');
  }

  private isValidCpf(cpf: string): boolean {
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    const calc = (digits: string, weights: number[]) => {
      const sum = digits
        .split('')
        .reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
      const rem = sum % 11;
      return rem < 2 ? 0 : 11 - rem;
    };
    const d1 = calc(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    if (d1 !== parseInt(cpf[9])) return false;
    const d2 = calc(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d2 === parseInt(cpf[10]);
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
      throw new ConflictException(AUTH_ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
    }

    if (existingCpf) {
      await this.auditLog.record({
        action: 'register.student.exists',
        outcome: 'failure',
        target: { email: dto.email },
        metadata: { reason: 'cpf_exists' },
      });
      throw new ConflictException('CPF já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const isInstitutional = this.isInstitutionalEmail(dto.email);
    const { code, codeHash, expiresAt } = this.generateVerificationCode();
    // TODO: Remover isso depois
    this.logger.debug(`[DEV ONLY] Verification code for ${dto.email}: ${code}`);

    // TODO: remover em produção
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
      refreshTokenHash: null,
      refreshTokenVersion: 0,
    });

    await this.mailService.sendVerificationCode(dto.email, code, isInstitutional);

    await this.auditLog.record({
      action: 'register.student',
      outcome: 'success',
      target: { email: dto.email },
      metadata: { institutional: isInstitutional },
    });

    this.logger.log(`Student registrado: ${dto.email} (institucional: ${isInstitutional})`);

    return {
      message: 'Código de verificação enviado para o seu e-mail',
      isInstitutional,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFY EMAIL
  // ═══════════════════════════════════════════════════════════════════════════

  async verifyStudentEmail(dto: VerifyEmailDto, res: Response): Promise<LoginResponse> {
    const student = await this.studentService.findByEmailWithSensitiveFields(dto.email);

    // Mensagem genérica — evita user enumeration
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

    const providedHash = this.hashVerificationCode(dto.code);
    const isMatch = this.safeEqualHex(providedHash, student.verificationCode);

    if (!isMatch) {
      const attempts = (student.verificationCodeAttempts ?? 0) + 1;
      const lockedUntil =
        attempts >= this.MAX_VERIFY_ATTEMPTS
          ? new Date(Date.now() + this.RESEND_COOLDOWN_MS)
          : null;

      await this.studentService.recordVerificationFailure(
        (student as any)._id.toString(),
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

    await this.studentService.activate((student as any)._id.toString());

    const payload: JwtPayload = {
      sub: (student as any)._id.toString(),
      role: UserRole.STUDENT,
      identifier: student.email,
      tokenUse: 'access',
    };

    const loginResponse = await this.issueAndSetCookie(
      payload,
      (student as any)._id.toString(),
      UserRole.STUDENT,
      res,
      student.name,
    );

    await this.auditLog.record({
      action: 'student.verify',
      outcome: 'success',
      actor: {
        id: (student as any)._id.toString(),
        role: UserRole.STUDENT,
        identifier: student.email,
      },
    });

    this.logger.log(`Student verificado: ${dto.email}`);
    return loginResponse;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESEND CODE
  // ═══════════════════════════════════════════════════════════════════════════

  async resendVerificationCode(dto: ResendCodeDto): Promise<{ message: string }> {
    const student = await this.studentService.findByEmailWithSensitiveFields(dto.email);

    // Resposta genérica — não revela se o email existe ou está pendente
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

    const { code, codeHash, expiresAt } = this.generateVerificationCode();

    await this.studentService.updateVerificationCode(
      (student as any)._id.toString(),
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
        id: (student as any)._id.toString(),
        role: UserRole.STUDENT,
        identifier: student.email,
      },
    });

    return genericMessage;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  async loginStudent(dto: StudentLoginDto, res: Response): Promise<LoginResponse> {
    const student = await this.studentService.findByEmailWithSensitiveFields(dto.email);

    // Hash dummy previne timing attack quando o usuário não existe
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
      // Lançar ACCOUNT_PENDING em vez de UNAUTHORIZED melhora UX sem vazar info de segurança:
      // o atacante já precisaria da senha correta para chegar aqui.
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_PENDING);
    }

    const payload: JwtPayload = {
      sub: (student as any)._id.toString(),
      role: UserRole.STUDENT,
      identifier: student.email,
      tokenUse: 'access',
    };

    const loginResponse = await this.issueAndSetCookie(
      payload,
      (student as any)._id.toString(),
      UserRole.STUDENT,
      res,
      student.name,
    );

    await this.auditLog.record({
      action: 'student.login',
      outcome: 'success',
      actor: {
        id: (student as any)._id.toString(),
        role: UserRole.STUDENT,
        identifier: student.email,
      },
    });

    this.logger.log(`Student logado: ${dto.email}`);
    return loginResponse;
  }

  async loginEmployee(dto: EmployeeLoginDto, res: Response): Promise<LoginResponse> {
    const employee = await this.employeeService.findByRegistrationIdWithPassword(
      dto.registrationId,
    );

    const passwordToCompare =
      employee?.password ?? '$2b$12$invalidhashfortimingattackprevention';
    const isValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!employee || !isValid) {
      await this.auditLog.record({
        action: 'employee.login',
        outcome: 'failure',
        target: { registrationId: dto.registrationId },
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    if (!employee.active) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const payload: JwtPayload = {
      sub: (employee as any)._id.toString(),
      role: UserRole.EMPLOYEE,
      identifier: employee.registrationId,
      tokenUse: 'access',
    };

    const loginResponse = await this.issueAndSetCookie(
      payload,
      (employee as any)._id.toString(),
      UserRole.EMPLOYEE,
      res,
      employee.name,
    );

    await this.auditLog.record({
      action: 'employee.login',
      outcome: 'success',
      actor: {
        id: (employee as any)._id.toString(),
        role: UserRole.EMPLOYEE,
        identifier: employee.registrationId,
      },
    });

    this.logger.log(`Employee logado: ${dto.registrationId}`);
    return loginResponse;
  }

  async loginAdmin(dto: AdminLoginDto, res: Response): Promise<LoginResponse> {
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

    const payload: JwtPayload = {
      sub: (admin as any)._id.toString(),
      role: UserRole.ADMIN,
      identifier: admin.username,
      tokenUse: 'access',
    };

    const loginResponse = await this.issueAndSetCookie(
      payload,
      (admin as any)._id.toString(),
      UserRole.ADMIN,
      res,
      admin.username,
    );

    await this.auditLog.record({
      action: 'admin.login',
      outcome: 'success',
      actor: {
        id: (admin as any)._id.toString(),
        role: UserRole.ADMIN,
        identifier: admin.username,
      },
    });

    this.logger.log(`Admin logado: ${dto.username}`);
    return loginResponse;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REFRESH TOKEN
  //
  // Fluxo de validação (nesta ordem, do mais barato ao mais caro):
  //   1. Verifica assinatura JWT e expiração             → falha rápida
  //   2. Confirma tokenUse === 'refresh'                 → rejeita access tokens
  //   3. Carrega sessão do banco                         → verifica isActive
  //   4. Compara tokenVersion (JWT vs banco)             → detecta reuse attack
  //   5. bcrypt.compare (hash do token bruto vs banco)   → validação definitiva
  //   6. Emite novo par, incrementa versão, set cookie   → rotação completa
  //
  // Por que tokenVersion antes de bcrypt?
  //   bcrypt é intencionalmente lento. A versão é um inteiro — comparação O(1).
  //   Se um token antigo chegar após rotação, rejeitamos antes de gastar CPU
  //   com bcrypt. E a detecção de reuse (versão do atacante > versão legítima)
  //   permite alertar/revogar a sessão proativamente.
  // ═══════════════════════════════════════════════════════════════════════════

  async refreshToken(rawRefreshToken: string, res: Response): Promise<LoginResponse> {
    // 1 + 2: Verifica assinatura JWT e tokenUse
    const payload = await this.tokenService.verifyRefreshToken(rawRefreshToken);

    if (payload.tokenUse !== 'refresh') {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.REFRESH_TOKEN_INVALID);
    }

    // 3: Carrega sessão do banco
    const session = await this.loadSessionForRefresh(payload);
    if (!session || !session.isActive) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.REFRESH_TOKEN_INVALID);
    }

    // 4: Compara tokenVersion — detecta reuse attack
    if (
      payload.tokenVersion === undefined ||
      payload.tokenVersion !== session.refreshTokenVersion
    ) {
      await this.auditLog.record({
        action: 'refresh.token',
        outcome: 'failure',
        actor: {
          id: payload.sub,
          role: payload.role,
          identifier: payload.identifier,
        },
        metadata: {
          reason: 'token_version_mismatch',
          jwtVersion: payload.tokenVersion,
          dbVersion: session.refreshTokenVersion,
        },
      });

      // Token reutilizado após rotação: invalida toda a sessão como medida de segurança.
      // O usuário legítimo será forçado a fazer login novamente.
      await this.clearRefreshTokenById(payload.sub, payload.role);

      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.TOKEN_REUSE_DETECTED);
    }

    // 5: bcrypt.compare — validação definitiva do token bruto
    const matches = await bcrypt.compare(rawRefreshToken, session.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.SESSION_REVOKED);
    }

    // 6: Emite novo par, persiste hash, set cookie
    const accessPayload: JwtPayload = {
      sub: payload.sub,
      role: payload.role,
      identifier: payload.identifier,
      tokenUse: 'access',
    };

    // Busca o nome do usuário para incluir no LoginResponse
    let refreshDisplayName = '';
    switch (payload.role) {
      case UserRole.STUDENT: {
        const s = await this.studentService.findById(payload.sub);
        refreshDisplayName = s?.name ?? '';
        break;
      }
      case UserRole.EMPLOYEE: {
        const e = await this.employeeService.findById(payload.sub);
        refreshDisplayName = e?.name ?? '';
        break;
      }
      case UserRole.ADMIN: {
        const a = await this.adminService.findById(payload.sub);
        refreshDisplayName = a?.username ?? '';
        break;
      }
    }

    const loginResponse = await this.issueAndSetCookie(
      accessPayload,
      payload.sub,
      payload.role,
      res,
      refreshDisplayName,
    );

    await this.auditLog.record({
      action: 'refresh.token',
      outcome: 'success',
      actor: {
        id: payload.sub,
        role: payload.role,
        identifier: payload.identifier,
      },
    });

    return loginResponse;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════════════

  async logout(user: AuthenticatedUser, res: Response): Promise<{ message: string }> {
    // Invalida o hash no banco primeiro — operação crítica
    await this.clearRefreshTokenById(user.id, user.role);

    // Limpa o cookie no cliente
    this.cookieService.clearRefreshTokenCookie(res);

    await this.auditLog.record({
      action: 'logout',
      outcome: 'success',
      actor: { id: user.id, role: user.role, identifier: user.identifier },
    });

    this.logger.log(`Logout: ${user.identifier} (${user.role})`);
    return { message: 'Logout successful' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Orquestra a emissão de tokens, persistência do hash e escrita do cookie.
   * Ponto único de saída para qualquer fluxo que precise emitir tokens
   * (login, verify, refresh) — garante que o cookie seja sempre setado.
   *
   * O refresh_token NUNCA sai deste método: vai direto para o cookie.
   * O LoginResponse retornado contém apenas access_token + user.
   */
  private async issueAndSetCookie(
    payload: JwtPayload,
    userId: string,
    role: UserRole,
    res: Response,
    name: string,
  ): Promise<LoginResponse> {
    const currentVersion = await this.getRefreshTokenVersion(userId, role);
    const nextVersion = (currentVersion ?? 0) + 1;

    const { access_token, refresh_token } = await this.tokenService.issueTokenPair(
      payload,
      nextVersion,
    );

    await this.persistRefreshToken(userId, role, refresh_token, nextVersion);

    // Cookie HTTP-only: o refresh_token nunca é retornado no body
    this.cookieService.setRefreshTokenCookie(res, refresh_token);

    return {
      access_token,
      user: {
        id: payload.sub,
        role: payload.role,
        identifier: payload.identifier,
        name,
      },
    };
  }

  private async persistRefreshToken(
    userId: string,
    role: UserRole,
    refreshToken: string,
    version: number,
  ): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, this.SALT_ROUNDS);

    switch (role) {
      case UserRole.STUDENT:
        await this.studentService.updateRefreshToken(userId, hash, version);
        return;
      case UserRole.EMPLOYEE:
        await this.employeeService.updateRefreshToken(userId, hash, version);
        return;
      case UserRole.ADMIN:
        await this.adminService.updateRefreshToken(userId, hash, version);
        return;
      default:
        throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }
  }

  private async clearRefreshTokenById(userId: string, role: UserRole): Promise<void> {
    switch (role) {
      case UserRole.STUDENT:
        await this.studentService.clearRefreshToken(userId);
        return;
      case UserRole.EMPLOYEE:
        await this.employeeService.clearRefreshToken(userId);
        return;
      case UserRole.ADMIN:
        await this.adminService.clearRefreshToken(userId);
        return;
      default:
        throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }
  }

  private async getRefreshTokenVersion(userId: string, role: UserRole): Promise<number> {
    switch (role) {
      case UserRole.STUDENT: {
        const student = await this.studentService.findById(userId);
        return student?.refreshTokenVersion ?? 0;
      }
      case UserRole.EMPLOYEE: {
        const employee = await this.employeeService.findById(userId);
        return employee?.refreshTokenVersion ?? 0;
      }
      case UserRole.ADMIN: {
        const admin = await this.adminService.findById(userId);
        return admin?.refreshTokenVersion ?? 0;
      }
      default:
        return 0;
    }
  }

  private async loadSessionForRefresh(
    payload: RefreshPayload,
  ): Promise<RefreshSession | null> {
    switch (payload.role) {
      case UserRole.STUDENT: {
        const student = await this.studentService.findByEmailWithSensitiveFields(
          payload.identifier,
        );
        if (!student?.refreshTokenHash) return null;
        return {
          refreshTokenHash: student.refreshTokenHash,
          refreshTokenVersion: student.refreshTokenVersion ?? 0,
          isActive: student.status === StudentStatus.ACTIVE,
        };
      }

      case UserRole.EMPLOYEE: {
        const employee = await this.employeeService.findByRegistrationIdWithPassword(
          payload.identifier,
        );
        if (!employee?.refreshTokenHash) return null;
        return {
          refreshTokenHash: employee.refreshTokenHash,
          refreshTokenVersion: employee.refreshTokenVersion ?? 0,
          isActive: employee.active,
        };
      }

      case UserRole.ADMIN: {
        const admin = await this.adminService.findByUsernameWithPassword(
          payload.identifier,
        );
        if (!admin?.refreshTokenHash) return null;
        return {
          refreshTokenHash: admin.refreshTokenHash,
          refreshTokenVersion: admin.refreshTokenVersion ?? 0,
          isActive: true, // Admins não têm status ativo/inativo
        };
      }

      default:
        return null;
    }
  }

  // ─── Verificação de email ────────────────────────────────────────────────

  private isInstitutionalEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return this.INSTITUTIONAL_DOMAINS.some(
      (inst) => domain === inst || domain.endsWith('.' + inst),
    );
  }

  private generateVerificationCode(): { code: string; codeHash: string; expiresAt: Date } {
    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = this.hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);
    return { code, codeHash, expiresAt };
  }

  private hashVerificationCode(code: string): string {
    const pepper = this.configService.getOrThrow<string>('OTP_PEPPER');
    return createHmac('sha256', pepper).update(code).digest('hex');
  }

  private safeEqualHex(leftHex: string, rightHex: string): boolean {
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
