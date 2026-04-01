import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { StudentService } from '../student/student.service';
import { EmployeeService } from '../employee/employee.service';
import { AdminService } from '../admin/admin.service';
import { MailService } from '../mail/mail.service';
import {
  StudentLoginDto,
  EmployeeLoginDto,
  AdminLoginDto,
  RegisterStudentDto,
  VerifyEmailDto,
  ResendCodeDto,
  RefreshTokenDto,
} from './dto/auth.dto';
import { AuthenticatedUser, JwtPayload, LoginResponse } from './interfaces/auth.interface';
import { AUTH_ERROR_MESSAGES } from './constants/auth.constants';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { StudentStatus } from '../student/schemas/student.schema';
import { AuditLogService } from '../common/audit/audit-log.service';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { StringValue } from 'ms';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly CODE_EXPIRY_MINUTES = 15;
  private readonly MAX_VERIFY_ATTEMPTS = 5;
  private readonly RESEND_COOLDOWN_MS = 60_000;

  // Domínios considerados institucionais — ajuste conforme necessário
  // Conderir os dominios da nossa regiao
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
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly auditLog: AuditLogService,
  ) {}

  // STUDENT

  async registerStudent(
    dto: RegisterStudentDto,
  ): Promise<{ message: string; isInstitutional: boolean }> {
    const existing = await this.studentService.findByEmail(dto.email);
    if (existing) {
      await this.auditLog.record({
        action: 'register.student.exists',
        outcome: 'failure',
        target: { email: dto.email },
        metadata: { reason: 'email_exists' },
      });
      throw new ConflictException(AUTH_ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const isInstitutional = this.isInstitutionalEmail(dto.email);
    const { code, codeHash, expiresAt } = this.generateVerificationCode();
    // TODO: Remover isso depois
    this.logger.debug(`[DEV ONLY] Verification code for ${dto.email}: ${code}`);

    await this.studentService.create({
      name: dto.name,
      email: dto.email,
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

    await this.mailService.sendVerificationCode(
      dto.email,
      code,
      isInstitutional,
    );

    await this.auditLog.record({
      action: 'register.student',
      outcome: 'success',
      target: { email: dto.email },
      metadata: { institutional: isInstitutional },
    });

    this.logger.log(
      `Student registrado: ${dto.email} (institucional: ${isInstitutional})`,
    );

    return {
      message: 'Código de verificação enviado para o seu e-mail',
      isInstitutional,
    };
  }

  async verifyStudentEmail(dto: VerifyEmailDto): Promise<LoginResponse> {
    // Busca com campos sensíveis para comparar código
    const student = await this.studentService.findByEmailWithSensitiveFields(
      dto.email,
    );

    // Mensagem genérica para evitar user enumeration e não revelar se o email existe ou o motivo da falha
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

    const provideHash = this.hashVerificationCode(dto.code);
    const isMatch = this.safeEqualHex(provideHash, student.verificationCode);

    if (!isMatch) {
      // Incrementa tentativas e bloqueia se atingir o limite
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

    const { access_token, refresh_token } = await this.issueAndPersistTokens(
      payload,
      (student as any)._id.toString(),
      UserRole.STUDENT,
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

    return {
      access_token,
      refresh_token,
      user: {
        id: payload.sub,
        role: UserRole.STUDENT,
        identifier: student.email,
      },
    };
  }

  async resendVerificationCode(
    dto: ResendCodeDto,
  ): Promise<{ message: string }> {
    const student = await this.studentService.findByEmailWithSensitiveFields(
      dto.email,
    );
    const genericMessage = {
      message:
        'Se o email estiver cadastrado e pendente, um novo código de verificação foi enviado',
    };

    if (!student || student.status === StudentStatus.ACTIVE) {
      return { message: genericMessage.message };
    }

    const lastSent = student.verificationCodeLastSentAt?.getTime?.() ?? 0; // Evita erro se for null ou undefined
    if (lastSent && Date.now() - lastSent < this.RESEND_COOLDOWN_MS) {
      return { message: genericMessage.message };
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
    return { message: genericMessage.message };
  }

  async loginStudent(dto: StudentLoginDto): Promise<LoginResponse> {
    const student = await this.studentService.findByEmailWithSensitiveFields(
      dto.email,
    );
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
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    const payload: JwtPayload = {
      sub: (student as any)._id.toString(),
      role: UserRole.STUDENT,
      identifier: student.email,
      tokenUse: 'access',
    };

    const tokens = await this.issueAndPersistTokens(
      payload,
      (student as any)._id.toString(),
      UserRole.STUDENT,
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

    return {
      ...tokens,
      user: {
        id: payload.sub,
        role: UserRole.STUDENT,
        identifier: student.email,
      },
    };
  }

  //Employee

  async loginEmployee(dto: EmployeeLoginDto): Promise<LoginResponse> {
    const employee =
      await this.employeeService.findByRegistrationIdWithPassword(
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

    const tokens = await this.issueAndPersistTokens(
      payload,
      (employee as any)._id.toString(),
      UserRole.EMPLOYEE,
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
    return {
      ...tokens,
      user: {
        id: payload.sub,
        role: UserRole.EMPLOYEE,
        identifier: employee.registrationId,
      },
    };
  }

  // Admin

  async loginAdmin(dto: AdminLoginDto): Promise<LoginResponse> {
    const admin = await this.adminService.findByUsernameWithPassword(
      dto.username,
    );
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

    const tokens = await this.issueAndPersistTokens(
      payload,
      (admin as any)._id.toString(),
      UserRole.ADMIN,
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
    return {
      ...tokens,
      user: {
        id: payload.sub,
        role: UserRole.ADMIN,
        identifier: admin.username,
      },
    };
  }

  // Refresh com rotação de token
  //
  // Fluxo:
  //   1. Valida assinatura JWT do refresh_token
  //   2. Verifica tokenUse === 'refresh'
  //   3. Carrega a sessão do banco (hash + versão)
  //   4. Verifica que a versão no JWT bate com a do banco
  //      → se não bater: token antigo reutilizado após rotação (reuse attack)
  //   5. Verifica bcrypt do token contra o hash persistido
  //   6. Emite novo par e incrementa tokenVersion no banco
  //      → o token anterior torna-se inválido imediatamente (versão desatualizada)
  //
  // Por que versão em vez de só hash?
  //   O bcrypt.compare é lento (intencional). Se um atacante roubou o refresh token
  //   e usa antes do usuário legítimo, emite um novo par e incrementa a versão.
  //   Quando o usuário legítimo tentar renovar com o token original (versão antiga),
  //   a checagem de versão falha instantaneamente — sem precisar de bcrypt.compare.
  //   Isso também sinaliza um possível reuse attack, que pode ser logado/alertado.

  async refreshToken(dto: RefreshTokenDto): Promise<LoginResponse> {
    const refreshToken =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    let payload: JwtPayload & { tokenVersion: number }; // Extende o payload esperado para incluir tokenVersion

    try {
      payload = await this.jwtService.verifyAsync(dto.refresh_token, {
        secret: refreshToken,
      });
    } catch {
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.REFRESH_TOKEN_INVALID,
      );
    }

    if (payload.tokenUse !== 'refresh') {
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.REFRESH_TOKEN_INVALID,
      );
    }

    const session = await this.loadSessionForRefresh(payload);
    if (!session || !session.isActive) {
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.REFRESH_TOKEN_INVALID,
      );
    }

    if (
      payload.tokenVersion !== session.refreshTokenVersion ||
      payload.tokenVersion === undefined
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

      await this.clearRefreshTokenById(payload.sub, payload.role);
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.REFRESH_TOKEN_INVALID,
      );
    }

    const matches = await bcrypt.compare(
      dto.refresh_token,
      session.refreshTokenHash,
    );
    if (!matches) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.SESSION_REVOKED);
    }

    const accessPayload: JwtPayload = {
      sub: payload.sub,
      role: payload.role,
      identifier: payload.identifier,
      tokenUse: 'access',
    };

    const tokens = await this.issueAndPersistTokens(
      accessPayload,
      payload.sub,
      payload.role,
    );

    await this.auditLog.record({
      action: 'refresh.token',
      outcome: 'success',
      actor: { id: payload.sub, role: payload.role, identifier: payload.identifier },
    });
    return {
      ...tokens,
      user: {id: payload.sub, role: payload.role, identifier: payload.identifier },
    } 
  }

  async logout(user: AuthenticatedUser): Promise<{ message: string }>{
    await this.clearRefreshTokenById(user.id, user.role);
    this.auditLog.record({
      action: 'logout',
      outcome: 'success',
      actor: { id: user.id, role: user.role, identifier: user.identifier },
    });
    return { message: 'Logout successful' };
  }

  // Helpers

  private async issueAndPersistTokens(
    payload: JwtPayload,
    userId: string,
    role: UserRole,
  ): Promise<{access_token: string; refresh_token: string}> {

    const currentVersion = await this.getRefreshTokenVersion(userId, role);
    const nextVersion = (currentVersion ?? 0) + 1;

    const {access_token, refresh_token} = await this.issueTokens(payload, nextVersion);
    await this.persistRefreshToken(userId, role, refresh_token, nextVersion);
    return { access_token, refresh_token };
  }


  private async issueTokens(
    payload: JwtPayload,
    tokenVersion: number,
  ): Promise<{ access_token: string; refresh_token: string }>{
    

    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as StringValue;

    const [ access_token, refresh_token ] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(
        // tokenVersion incluído no refresh JWT para detecção de reuse
        { ...payload, tokenUse: 'refresh', tokenVersion },
        { secret: refreshSecret, expiresIn: refreshExpiresIn },
      ),
    ])

    return { access_token, refresh_token };
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
    payload: JwtPayload
  ): Promise<{ refreshTokenHash: string; refreshTokenVersion: number; isActive: boolean } | null> {
    switch (payload.role) {
      case UserRole.STUDENT: {
        const student = await this.studentService.findByEmailWithSensitiveFields(payload.identifier);
        return student?.refreshTokenHash
        ?{
          refreshTokenHash: student.refreshTokenHash,
          refreshTokenVersion: student.refreshTokenVersion ?? 0,
          isActive: student.status === StudentStatus.ACTIVE,
          }
        : null 
      }

      case UserRole.EMPLOYEE: {
        const employee = await this.employeeService.findByRegistrationIdWithPassword(payload.identifier);
        return employee?.refreshTokenHash
        ?{
          refreshTokenHash: employee.refreshTokenHash,
          refreshTokenVersion: employee.refreshTokenVersion ?? 0,
          isActive: employee.active,
          }
        : null 
      }

      case UserRole.ADMIN: {
        const admin = await this.adminService.findByUsernameWithPassword(payload.identifier);
        return admin?.refreshTokenHash
        ?{
          refreshTokenHash: admin.refreshTokenHash,
          refreshTokenVersion: admin.refreshTokenVersion ?? 0,
          isActive: true, // Admins não têm status ativo/inativo no momento
          }
        : null 
      }

      default:
        return null;
    }
  }

  private isInstitutionalEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return this.INSTITUTIONAL_DOMAINS.some(
      (inst) => domain === inst || domain.endsWith('.' + inst),
    );
  }

  // Gera um código de verificação numérico, seu hash seguro e a data de expiração
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
  // Compara o código fornecido com o hash armazenado de forma segura
  private safeEqualHex(leftHex: string, rightHex: string): boolean {
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
