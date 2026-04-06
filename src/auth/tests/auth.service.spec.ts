import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'crypto';

import { AuthService } from '../auth.service';
import { StudentService } from '../../student/student.service';
import { EmployeeService } from '../../employee/employee.service';
import { AdminService } from '../../admin/admin.service';
import { MailService } from '../../mail/mail.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../session/session.service';
import { UserRole } from '../../common/interfaces/user-roles.enum';
import { StudentStatus } from '../../student/schemas/student.schema';

const mockStudentService = {
  findByEmail: jest.fn(),
  findByCpfHash: jest.fn(),
  findByEmailWithSensitiveFields: jest.fn(),
  create: jest.fn(),
  activate: jest.fn(),
  updateVerificationCode: jest.fn(),
  recordVerificationFailure: jest.fn(),
};

const mockEmployeeService = {
  findByRegistrationIdWithPassword: jest.fn(),
};

const mockAdminService = {
  findByUsernameWithPassword: jest.fn(),
};

const mockMailService = {
  sendVerificationCode: jest.fn(),
};

const mockAuditLog = {
  record: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    const config: Record<string, string> = {
      OTP_PEPPER: 'test-pepper',
      CPF_HMAC_SECRET: 'test-cpf-hmac-secret',
    };

    const value = config[key];
    if (!value) throw new Error(`Missing config: ${key}`);
    return value;
  }),
};

const mockSessionService = {
  createSession: jest.fn(),
  revokeSession: jest.fn(),
};

const makeStudent = (overrides = {}) => ({
  _id: { toString: () => 'student-id-123' },
  name: 'Aluno Teste',
  email: 'aluno@test.com',
  password: '$2b$12$hashedpassword',
  status: StudentStatus.ACTIVE,
  isInstitutionalEmail: false,
  verificationCode: null,
  verificationCodeExpiresAt: null,
  verificationCodeAttempts: 0,
  verificationCodeLockedUntil: null,
  verificationCodeLastSentAt: null,
  ...overrides,
});

const makeEmployee = (overrides = {}) => ({
  _id: { toString: () => 'employee-id-123' },
  name: 'Funcionario Teste',
  registrationId: 'MAT001',
  password: '$2b$12$hashedpassword',
  active: true,
  ...overrides,
});

const makeAdmin = (overrides = {}) => ({
  _id: { toString: () => 'admin-id-123' },
  username: 'admin',
  password: '$2b$12$hashedpassword',
  ...overrides,
});

describe('AuthService (Fase 2 - Session First)', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: StudentService, useValue: mockStudentService },
        { provide: EmployeeService, useValue: mockEmployeeService },
        { provide: AdminService, useValue: mockAdminService },
        { provide: MailService, useValue: mockMailService },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();

    mockSessionService.createSession.mockResolvedValue({
      sessionId: '507f1f77bcf86cd799439011',
      userId: 'student-id-123',
      userType: UserRole.STUDENT,
      expiresAt: new Date(Date.now() + 3600_000),
      lastSeenAt: new Date(),
      revoked: false,
    });
  });

  describe('registerStudent', () => {
    const dto = {
      name: 'Joao Silva',
      email: 'joao@test.com',
      password: 'Senha123',
      telephone: '11999999999',
      cpf: '11144477735',
    };

    it('deve registrar e enviar OTP', async () => {
      mockStudentService.findByEmail.mockResolvedValue(null);
      mockStudentService.findByCpfHash.mockResolvedValue(null);
      mockStudentService.create.mockResolvedValue({});
      mockMailService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.registerStudent(dto as any);

      expect(result.message).toBeDefined();
      expect(mockStudentService.create).toHaveBeenCalledTimes(1);
      expect(mockMailService.sendVerificationCode).toHaveBeenCalledTimes(1);
    });

    it('deve bloquear email duplicado', async () => {
      mockStudentService.findByEmail.mockResolvedValue(makeStudent());
      mockStudentService.findByCpfHash.mockResolvedValue(null);

      await expect(service.registerStudent(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('loginStudent', () => {
    const dto = { email: 'aluno@test.com', password: 'Senha123' };

    it('deve autenticar e retornar sessao (sem JWT no body)', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({ password: hashed, status: StudentStatus.ACTIVE }),
      );

      const result = await service.loginStudent(dto, {
        userAgent: 'jest-agent',
        ipAddress: '127.0.0.1',
      });

      expect(result.ok).toBe(true);
      expect(result.sessionId).toBe('507f1f77bcf86cd799439011');
      expect((result as any).access_token).toBeUndefined();
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        'student-id-123',
        UserRole.STUDENT,
        { userAgent: 'jest-agent', ipAddress: '127.0.0.1' },
      );
    });

    it('deve rejeitar credenciais inválidas', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(null);

      await expect(
        service.loginStudent(dto, { userAgent: 'jest-agent' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyStudentEmail', () => {
    const dto = { email: 'aluno@test.com', code: '123456' };

    it('deve verificar, ativar e criar sessão', async () => {
      const codeHash = createHmac('sha256', 'test-pepper')
        .update('123456')
        .digest('hex');

      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({
          status: StudentStatus.PENDING,
          verificationCode: codeHash,
          verificationCodeExpiresAt: new Date(Date.now() + 60_000),
        }),
      );
      mockStudentService.activate.mockResolvedValue(undefined);

      const result = await service.verifyStudentEmail(dto, {
        userAgent: 'jest-agent',
      });

      expect(result.ok).toBe(true);
      expect(result.sessionId).toBe('507f1f77bcf86cd799439011');
      expect(mockStudentService.activate).toHaveBeenCalledWith('student-id-123');
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        'student-id-123',
        UserRole.STUDENT,
        { userAgent: 'jest-agent' },
      );
    });

    it('deve rejeitar conta já ativa', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({ status: StudentStatus.ACTIVE }),
      );

      await expect(
        service.verifyStudentEmail(dto, { userAgent: 'jest-agent' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('loginEmployee', () => {
    it('deve criar sessão para employee', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockEmployeeService.findByRegistrationIdWithPassword.mockResolvedValue(
        makeEmployee({ password: hashed }),
      );

      const result = await service.loginEmployee(
        { registrationId: 'MAT001', password: 'Senha123' },
        { ipAddress: '10.0.0.1' },
      );

      expect(result.ok).toBe(true);
      expect(result.user.role).toBe(UserRole.EMPLOYEE);
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        'employee-id-123',
        UserRole.EMPLOYEE,
        { ipAddress: '10.0.0.1' },
      );
    });
  });

  describe('loginAdmin', () => {
    it('deve criar sessão para admin', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockAdminService.findByUsernameWithPassword.mockResolvedValue(
        makeAdmin({ password: hashed }),
      );

      const result = await service.loginAdmin(
        { username: 'admin', password: 'Senha123' },
        {},
      );

      expect(result.ok).toBe(true);
      expect(result.user.role).toBe(UserRole.ADMIN);
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        'admin-id-123',
        UserRole.ADMIN,
        {},
      );
    });
  });

  describe('logout (idempotente)', () => {
    it('deve retornar ok mesmo sem sessão', async () => {
      const result = await service.logout(undefined);

      expect(result).toEqual({ ok: true });
      expect(mockSessionService.revokeSession).not.toHaveBeenCalled();
    });

    it('deve revogar sessão quando houver sessionId', async () => {
      mockSessionService.revokeSession.mockResolvedValue(undefined);

      const result = await service.logout('507f1f77bcf86cd799439011');

      expect(result).toEqual({ ok: true });
      expect(mockSessionService.revokeSession).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });

    it('deve continuar idempotente mesmo se revoke falhar', async () => {
      mockSessionService.revokeSession.mockRejectedValue(new Error('db error'));

      const result = await service.logout('507f1f77bcf86cd799439011');

      expect(result).toEqual({ ok: true });
    });
  });
});
