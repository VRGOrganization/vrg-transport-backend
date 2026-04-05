import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import * as bcrypt from 'bcrypt';

import { AuthService } from '../auth.service';
import { TokenService } from '../services/token.service';
import { CookieService } from '../services/cookie.service';
import { StudentService } from '../../student/student.service';
import { EmployeeService } from '../../employee/employee.service';
import { AdminService } from '../../admin/admin.service';
import { MailService } from '../../mail/mail.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../common/interfaces/user-roles.enum';
import { StudentStatus } from '../../student/schemas/student.schema';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockStudentService = {
  findByEmail: jest.fn(),
  findByEmailWithSensitiveFields: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  activate: jest.fn(),
  updateVerificationCode: jest.fn(),
  recordVerificationFailure: jest.fn(),
  updateRefreshToken: jest.fn(),
  clearRefreshToken: jest.fn(),
};

const mockEmployeeService = {
  findByRegistrationIdWithPassword: jest.fn(),
  findById: jest.fn(),
  updateRefreshToken: jest.fn(),
  clearRefreshToken: jest.fn(),
};

const mockAdminService = {
  findByUsernameWithPassword: jest.fn(),
  findById: jest.fn(),
  updateRefreshToken: jest.fn(),
  clearRefreshToken: jest.fn(),
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
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_REFRESH_EXPIRES_IN: '7d',
      NODE_ENV: 'test',
    };
    return config[key] ?? 'default-value';
  }),
  get: jest.fn((key: string) => {
    if (key === 'NODE_ENV') return 'test';
    return undefined;
  }),
};

const mockTokenService = {
  issueTokenPair: jest.fn().mockResolvedValue({
    access_token: 'mock.access.token',
    refresh_token: 'mock.refresh.token',
  }),
  verifyRefreshToken: jest.fn(),
};

const mockCookieService = {
  setRefreshTokenCookie: jest.fn(),
  clearRefreshTokenCookie: jest.fn(),
  extractRefreshToken: jest.fn(),
};

// ── Response mock ─────────────────────────────────────────────────────────────

const mockRes = {
  cookie: jest.fn(),
  clearCookie: jest.fn(),
} as unknown as Response;

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeStudent = (overrides = {}) => ({
  _id: { toString: () => 'student-id-123' },
  email: 'aluno@test.com',
  password: '$2b$12$hashedpassword',
  status: StudentStatus.ACTIVE,
  isInstitutionalEmail: false,
  refreshTokenHash: null,
  refreshTokenVersion: 0,
  verificationCode: null,
  verificationCodeExpiresAt: null,
  verificationCodeAttempts: 0,
  verificationCodeLockedUntil: null,
  verificationCodeLastSentAt: null,
  ...overrides,
});

const makeEmployee = (overrides = {}) => ({
  _id: { toString: () => 'employee-id-123' },
  registrationId: 'MAT001',
  password: '$2b$12$hashedpassword',
  active: true,
  refreshTokenHash: null,
  refreshTokenVersion: 0,
  ...overrides,
});

const makeAdmin = (overrides = {}) => ({
  _id: { toString: () => 'admin-id-123' },
  username: 'admin',
  password: '$2b$12$hashedpassword',
  refreshTokenHash: null,
  refreshTokenVersion: 0,
  ...overrides,
});

// ── Suite ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
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
        { provide: TokenService, useValue: mockTokenService },
        { provide: CookieService, useValue: mockCookieService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();

    // TokenService sempre retorna tokens válidos por padrão
    mockTokenService.issueTokenPair.mockResolvedValue({
      access_token: 'mock.access.token',
      refresh_token: 'mock.refresh.token',
    });
  });

  // ── registerStudent ────────────────────────────────────────────────────────

  describe('registerStudent', () => {
    const dto = {
      name: 'João Silva',
      email: 'joao@test.com',
      password: 'Senha123',
      telephone: '11999999999',
    };

    it('deve registrar student e enviar e-mail', async () => {
      mockStudentService.findByEmail.mockResolvedValue(null);
      mockStudentService.create.mockResolvedValue({});
      mockMailService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.registerStudent(dto as any);

      expect(result.message).toBeDefined();
      expect(result.isInstitutional).toBe(false);
      expect(mockStudentService.create).toHaveBeenCalledTimes(1);
      expect(mockMailService.sendVerificationCode).toHaveBeenCalledTimes(1);
    });

    it('deve detectar e-mail institucional', async () => {
      mockStudentService.findByEmail.mockResolvedValue(null);
      mockStudentService.create.mockResolvedValue({});
      mockMailService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.registerStudent({
        ...dto,
        email: 'joao@usp.br',
      } as any);

      expect(result.isInstitutional).toBe(true);
    });

    it('deve lançar ConflictException se e-mail já existir', async () => {
      mockStudentService.findByEmail.mockResolvedValue(makeStudent());

      await expect(service.registerStudent(dto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockStudentService.create).not.toHaveBeenCalled();
    });
  });

  // ── verifyStudentEmail ─────────────────────────────────────────────────────

  describe('verifyStudentEmail', () => {
    const dto = { email: 'joao@test.com', code: '123456' };

    it('deve verificar e retornar access_token (sem refresh_token no body)', async () => {
      // Gera um hash real do código usando o mesmo pepper do mock
      const crypto = await import('crypto');
      const codeHash = crypto
        .createHmac('sha256', 'test-pepper')
        .update('123456')
        .digest('hex');

      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({
          status: StudentStatus.PENDING,
          verificationCode: codeHash,
          verificationCodeExpiresAt: new Date(Date.now() + 60_000),
        }),
      );
      mockStudentService.findById.mockResolvedValue(
        makeStudent({ status: StudentStatus.PENDING }),
      );
      mockStudentService.activate.mockResolvedValue(undefined);
      mockStudentService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.verifyStudentEmail(dto, mockRes);

      // access_token presente no body
      expect(result.access_token).toBe('mock.access.token');
      expect(result.user.role).toBe(UserRole.STUDENT);

      // refresh_token NÃO deve estar no retorno — vai para o cookie
      expect((result as any).refresh_token).toBeUndefined();

      // Cookie deve ter sido setado via CookieService
      expect(mockCookieService.setRefreshTokenCookie).toHaveBeenCalledWith(
        mockRes,
        'mock.refresh.token',
      );
    });

    it('deve lançar UnauthorizedException se código estiver errado', async () => {
      const crypto = await import('crypto');
      const codeHash = crypto
        .createHmac('sha256', 'test-pepper')
        .update('999999') // código diferente
        .digest('hex');

      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({
          status: StudentStatus.PENDING,
          verificationCode: codeHash,
          verificationCodeExpiresAt: new Date(Date.now() + 60_000),
          verificationCodeAttempts: 0,
        }),
      );
      mockStudentService.recordVerificationFailure.mockResolvedValue(undefined);

      await expect(service.verifyStudentEmail(dto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockCookieService.setRefreshTokenCookie).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException se código expirou', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({
          status: StudentStatus.PENDING,
          verificationCode: 'qualquer-hash',
          verificationCodeExpiresAt: new Date(Date.now() - 1_000), // passado
        }),
      );

      await expect(service.verifyStudentEmail(dto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar BadRequestException se conta já estiver ativa', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({ status: StudentStatus.ACTIVE }),
      );

      await expect(service.verifyStudentEmail(dto, mockRes)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lançar UnauthorizedException se student não existir', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(null);

      await expect(service.verifyStudentEmail(dto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── loginStudent ───────────────────────────────────────────────────────────

  describe('loginStudent', () => {
    const dto = { email: 'joao@test.com', password: 'Senha123' };

    it('deve logar student e retornar access_token sem refresh_token no body', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({ password: hashed, status: StudentStatus.ACTIVE }),
      );
      mockStudentService.findById.mockResolvedValue(makeStudent());
      mockStudentService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.loginStudent(dto, mockRes);

      expect(result.access_token).toBe('mock.access.token');
      expect(result.user.role).toBe(UserRole.STUDENT);
      expect((result as any).refresh_token).toBeUndefined();
      expect(mockCookieService.setRefreshTokenCookie).toHaveBeenCalledWith(
        mockRes,
        'mock.refresh.token',
      );
    });

    it('deve lançar UnauthorizedException com senha errada', async () => {
      const hashed = await bcrypt.hash('OutraSenha123', 10);
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({ password: hashed, status: StudentStatus.ACTIVE }),
      );

      await expect(service.loginStudent(dto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockCookieService.setRefreshTokenCookie).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException se conta estiver PENDING', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({ password: hashed, status: StudentStatus.PENDING }),
      );

      await expect(service.loginStudent(dto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException se student não existir', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(null);

      await expect(service.loginStudent(dto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── loginEmployee ──────────────────────────────────────────────────────────

  describe('loginEmployee', () => {
    const dto = { registrationId: 'MAT001', password: 'Senha123' };

    it('deve logar employee e retornar access_token sem refresh_token no body', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockEmployeeService.findByRegistrationIdWithPassword.mockResolvedValue(
        makeEmployee({ password: hashed }),
      );
      mockEmployeeService.findById.mockResolvedValue(makeEmployee());
      mockEmployeeService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.loginEmployee(dto, mockRes);

      expect(result.access_token).toBe('mock.access.token');
      expect(result.user.role).toBe(UserRole.EMPLOYEE);
      expect((result as any).refresh_token).toBeUndefined();
      expect(mockCookieService.setRefreshTokenCookie).toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException com senha errada', async () => {
      const hashed = await bcrypt.hash('OutraSenha123', 10);
      mockEmployeeService.findByRegistrationIdWithPassword.mockResolvedValue(
        makeEmployee({ password: hashed }),
      );

      await expect(service.loginEmployee(dto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException se employee não existir', async () => {
      mockEmployeeService.findByRegistrationIdWithPassword.mockResolvedValue(
        null,
      );

      await expect(service.loginEmployee(dto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── loginAdmin ─────────────────────────────────────────────────────────────

  describe('loginAdmin', () => {
    const dto = { username: 'admin', password: 'Senha123' };

    it('deve logar admin e retornar access_token sem refresh_token no body', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockAdminService.findByUsernameWithPassword.mockResolvedValue(
        makeAdmin({ password: hashed }),
      );
      mockAdminService.findById.mockResolvedValue(makeAdmin());
      mockAdminService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.loginAdmin(dto, mockRes);

      expect(result.access_token).toBe('mock.access.token');
      expect(result.user.role).toBe(UserRole.ADMIN);
      expect((result as any).refresh_token).toBeUndefined();
      expect(mockCookieService.setRefreshTokenCookie).toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException com senha errada', async () => {
      const hashed = await bcrypt.hash('OutraSenha123', 10);
      mockAdminService.findByUsernameWithPassword.mockResolvedValue(
        makeAdmin({ password: hashed }),
      );

      await expect(service.loginAdmin(dto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException se admin não existir', async () => {
      mockAdminService.findByUsernameWithPassword.mockResolvedValue(null);

      await expect(service.loginAdmin(dto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── refreshToken ───────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    const rawToken = 'valid.refresh.token';

    const makeRefreshPayload = (overrides = {}) => ({
      sub: 'student-id-123',
      role: UserRole.STUDENT,
      identifier: 'aluno@test.com',
      tokenUse: 'refresh' as const,
      tokenVersion: 3,
      ...overrides,
    });

    it('deve rotacionar tokens e setar novo cookie', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue(
        makeRefreshPayload(),
      );

      const hashed = await bcrypt.hash(rawToken, 10);
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({
          refreshTokenHash: hashed,
          refreshTokenVersion: 3,
          status: StudentStatus.ACTIVE,
        }),
      );
      mockStudentService.findById.mockResolvedValue(
        makeStudent({ refreshTokenVersion: 3 }),
      );
      mockStudentService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.refreshToken(rawToken, mockRes);

      expect(result.access_token).toBe('mock.access.token');
      expect((result as any).refresh_token).toBeUndefined();
      expect(mockCookieService.setRefreshTokenCookie).toHaveBeenCalledWith(
        mockRes,
        'mock.refresh.token',
      );
    });

    it('deve lançar UnauthorizedException se tokenUse não for refresh', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue(
        makeRefreshPayload({ tokenUse: 'access' }),
      );

      await expect(service.refreshToken(rawToken, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar e revogar sessão se tokenVersion não bater (reuse attack)', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue(
        makeRefreshPayload({ tokenVersion: 1 }), // versão antiga
      );

      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({
          refreshTokenHash: 'any-hash',
          refreshTokenVersion: 5, // banco está na versão 5
          status: StudentStatus.ACTIVE,
        }),
      );
      mockStudentService.clearRefreshToken.mockResolvedValue(undefined);

      await expect(service.refreshToken(rawToken, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );

      // Sessão deve ser invalidada como medida de segurança
      expect(mockStudentService.clearRefreshToken).toHaveBeenCalledWith(
        'student-id-123',
      );
      expect(mockCookieService.setRefreshTokenCookie).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException se JWT for inválido', async () => {
      mockTokenService.verifyRefreshToken.mockRejectedValue(
        new UnauthorizedException('invalid'),
      );

      await expect(service.refreshToken(rawToken, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('deve invalidar token no banco e limpar cookie', async () => {
      const user = {
        id: 'student-id-123',
        role: UserRole.STUDENT,
        identifier: 'aluno@test.com',
      };
      mockStudentService.clearRefreshToken.mockResolvedValue(undefined);

      const result = await service.logout(user, mockRes);

      expect(result.message).toBe('Logout successful');
      expect(mockStudentService.clearRefreshToken).toHaveBeenCalledWith(
        user.id,
      );
      expect(mockCookieService.clearRefreshTokenCookie).toHaveBeenCalledWith(
        mockRes,
      );
    });
  });
});
