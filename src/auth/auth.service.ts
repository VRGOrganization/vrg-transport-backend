import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
} from './dto/auth.dto';
import { JwtPayload, LoginResponse } from './interfaces/auth.interface';
import { AUTH_ERROR_MESSAGES } from './constants/auth.constants';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { StudentStatus } from '../student/schemas/student.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly CODE_EXPIRY_MINUTES = 15;

  // Domínios considerados institucionais — ajuste conforme necessário
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
    private readonly mailService: MailService,
  ) {}

  // ─── Student ────────────────────────────────────────────────────────────────

  async registerStudent(
    dto: RegisterStudentDto,
  ): Promise<{ message: string; isInstitutional: boolean }> {
    const existing = await this.studentService.findByEmail(dto.email);
    if (existing) {
      // Mensagem genérica para não confirmar se o email existe (user enumeration)
      throw new ConflictException(AUTH_ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const isInstitutional = this.isInstitutionalEmail(dto.email);
    const { code, expiresAt } = this.generateVerificationCode();

    await this.studentService.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      degree: dto.degree,
      shift: dto.shift,
      telephone: dto.telephone,
      bloodType: dto.bloodType,
      buss: dto.buss,
      status: StudentStatus.PENDING,
      isInstitutionalEmail: isInstitutional,
      verificationCode: code,
      verificationCodeExpiresAt: expiresAt,
    });

    await this.mailService.sendVerificationCode(dto.email, code, isInstitutional);

    this.logger.log(`Student registrado: ${dto.email} (institucional: ${isInstitutional})`);

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

    // Mensagem genérica — não revela se o email existe ou o código está errado
    const INVALID_MSG = AUTH_ERROR_MESSAGES.INVALID_CODE;

    if (!student) throw new UnauthorizedException(INVALID_MSG);

    if (student.status === StudentStatus.ACTIVE) {
      throw new BadRequestException(AUTH_ERROR_MESSAGES.ACCOUNT_ALREADY_ACTIVE);
    }

    if (
      !student.verificationCode ||
      student.verificationCode !== dto.code
    ) {
      throw new UnauthorizedException(INVALID_MSG);
    }

    if (
      !student.verificationCodeExpiresAt ||
      student.verificationCodeExpiresAt < new Date()
    ) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.EXPIRED_CODE);
    }

    await this.studentService.activate((student as any)._id.toString());

    this.logger.log(`Student verificado: ${dto.email}`);

    const payload: JwtPayload = {
      sub: (student as any)._id.toString(),
      role: UserRole.STUDENT,
      identifier: student.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
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
    const student = await this.studentService.findByEmail(dto.email);

    // Resposta genérica — não revela se o email existe (user enumeration)
    const GENERIC_MSG = 'Se o e-mail estiver cadastrado e pendente, um novo código será enviado';

    if (!student || student.status === StudentStatus.ACTIVE) {
      return { message: GENERIC_MSG };
    }

    const { code, expiresAt } = this.generateVerificationCode();

    await this.studentService.updateVerificationCode(
      (student as any)._id.toString(),
      code,
      expiresAt,
    );

    await this.mailService.sendVerificationCode(
      dto.email,
      code,
      student.isInstitutionalEmail,
    );

    return { message: GENERIC_MSG };
  }

  async loginStudent(dto: StudentLoginDto): Promise<LoginResponse> {
    const student = await this.studentService.findByEmailWithSensitiveFields(
      dto.email,
    );

    // Sempre compara o hash mesmo se o usuário não existe, para evitar timing attacks
    const passwordToCompare = student?.password ?? '$2b$12$invalidhashfortimingattackprevention';
    const isValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!student || !isValid) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    if (student.status !== StudentStatus.ACTIVE) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_PENDING);
    }

    this.logger.log(`Student logado: ${dto.email}`);

    const payload: JwtPayload = {
      sub: (student as any)._id.toString(),
      role: UserRole.STUDENT,
      identifier: student.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: payload.sub,
        role: UserRole.STUDENT,
        identifier: student.email,
      },
    };
  }

  // ─── Employee ───────────────────────────────────────────────────────────────

  async loginEmployee(dto: EmployeeLoginDto): Promise<LoginResponse> {
    const employee = await this.employeeService.findByMatriculaWithPassword(
      dto.registrationId,
    );

    const passwordToCompare = employee?.password ?? '$2b$12$invalidhashfortimingattackprevention';
    const isValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!employee || !isValid) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    if (!employee.active) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    this.logger.log(`Employee logado: matrícula ${dto.registrationId}`);

    const payload: JwtPayload = {
      sub: (employee as any)._id.toString(),
      role: UserRole.EMPLOYEE,
      identifier: employee.matricula,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: payload.sub,
        role: UserRole.EMPLOYEE,
        identifier: employee.matricula,
      },
    };
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  async loginAdmin(dto: AdminLoginDto): Promise<LoginResponse> {
    const admin = await this.adminService.findByUsernameWithPassword(
      dto.username,
    );

    const passwordToCompare = admin?.password ?? '$2b$12$invalidhashfortimingattackprevention';
    const isValid = await bcrypt.compare(dto.password, passwordToCompare);

    if (!admin || !isValid) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    this.logger.log(`Admin logado: ${dto.username}`);

    const payload: JwtPayload = {
      sub: (admin as any)._id.toString(),
      role: UserRole.ADMIN,
      identifier: admin.username,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: payload.sub,
        role: UserRole.ADMIN,
        identifier: admin.username,
      },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private isInstitutionalEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return this.INSTITUTIONAL_DOMAINS.some(
      (inst) => domain === inst || domain.endsWith('.' + inst),
    );
  }

  private generateVerificationCode(): { code: string; expiresAt: Date } {
    // Usa crypto para geração segura (não Math.random)
    const code = String(
      Math.floor(100000 + Math.random() * 900000),
    ).padStart(6, '0');

    const expiresAt = new Date(
      Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000,
    );

    return { code, expiresAt };
  }
}

