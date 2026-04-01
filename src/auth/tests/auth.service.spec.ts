import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { StudentService } from '../../student/student.service';
import { EmployeeService } from '../../employee/employee.service';
import { AdminService } from '../../admin/admin.service';
import { MailService } from '../../mail/mail.service';
import { UserRole } from '../../common/interfaces/user-roles.enum';
import { StudentStatus } from '../../student/schemas/student.schema';
import * as bcrypt from 'bcrypt';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockStudentService = {
  findByEmail: jest.fn(),
  findByEmailWithSensitiveFields: jest.fn(),
  create: jest.fn(),
  activate: jest.fn(),
  updateVerificationCode: jest.fn(),
};

const mockEmployeeService = {
  findByMatriculaWithPassword: jest.fn(),
};

const mockAdminService = {
  findByUsernameWithPassword: jest.fn(),
};

const mockMailService = {
  sendVerificationCode: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeStudent = (overrides = {}) => ({
  _id: { toString: () => 'student-id-123' },
  email: 'aluno@test.com',
  password: '$2b$12$hashedpassword',
  status: StudentStatus.ACTIVE,
  isInstitutionalEmail: false,
  ...overrides,
});

const makeEmployee = (overrides = {}) => ({
  _id: { toString: () => 'employee-id-123' },
  matricula: 'MAT001',
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
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── registerStudent ────────────────────────────────────────────────────────

  describe('registerStudent', () => {
    const dto = {
      name: 'João Silva',
      email: 'joao@test.com',
      password: 'Senha123',
      degree: 'Ciência da Computação',
      shift: 'Noturno',
      telephone: '11999999999',
      bloodType: 'A+',
      buss: 'Linha 1',
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

    it('deve verificar e retornar JWT', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({
          status: StudentStatus.PENDING,
          verificationCode: '123456',
          verificationCodeExpiresAt: new Date(Date.now() + 60000),
        }),
      );
      mockStudentService.activate.mockResolvedValue(undefined);

      const result = await service.verifyStudentEmail(dto);

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.user.role).toBe(UserRole.STUDENT);
      expect(mockStudentService.activate).toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException se código estiver errado', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({
          status: StudentStatus.PENDING,
          verificationCode: '999999',
          verificationCodeExpiresAt: new Date(Date.now() + 60000),
        }),
      );

      await expect(service.verifyStudentEmail(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException se código expirou', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({
          status: StudentStatus.PENDING,
          verificationCode: '123456',
          verificationCodeExpiresAt: new Date(Date.now() - 1000), // passado
        }),
      );

      await expect(service.verifyStudentEmail(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar BadRequestException se conta já estiver ativa', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({ status: StudentStatus.ACTIVE }),
      );

      await expect(service.verifyStudentEmail(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lançar UnauthorizedException se student não existir', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(null);

      await expect(service.verifyStudentEmail(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── loginStudent ───────────────────────────────────────────────────────────

  describe('loginStudent', () => {
    const dto = { email: 'joao@test.com', password: 'Senha123' };

    it('deve logar student ativo com credenciais corretas', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({ password: hashed, status: StudentStatus.ACTIVE }),
      );

      const result = await service.loginStudent(dto);

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.user.role).toBe(UserRole.STUDENT);
    });

    it('deve lançar UnauthorizedException com senha errada', async () => {
      const hashed = await bcrypt.hash('OutraSenha123', 10);
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({ password: hashed, status: StudentStatus.ACTIVE }),
      );

      await expect(service.loginStudent(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException se conta estiver PENDING', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(
        makeStudent({ password: hashed, status: StudentStatus.PENDING }),
      );

      await expect(service.loginStudent(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException se student não existir', async () => {
      mockStudentService.findByEmailWithSensitiveFields.mockResolvedValue(null);

      await expect(service.loginStudent(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── loginEmployee ──────────────────────────────────────────────────────────

  describe('loginEmployee', () => {
    const dto = { registrationId: 'MAT001', password: 'Senha123' };

    it('deve logar employee ativo com credenciais corretas', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockEmployeeService.findByMatriculaWithPassword.mockResolvedValue(
        makeEmployee({ password: hashed }),
      );

      const result = await service.loginEmployee(dto);

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.user.role).toBe(UserRole.EMPLOYEE);
    });

    it('deve lançar UnauthorizedException com senha errada', async () => {
      const hashed = await bcrypt.hash('OutraSenha123', 10);
      mockEmployeeService.findByMatriculaWithPassword.mockResolvedValue(
        makeEmployee({ password: hashed }),
      );

      await expect(service.loginEmployee(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException se employee não existir', async () => {
      mockEmployeeService.findByMatriculaWithPassword.mockResolvedValue(null);

      await expect(service.loginEmployee(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── loginAdmin ─────────────────────────────────────────────────────────────

  describe('loginAdmin', () => {
    const dto = { username: 'admin', password: 'Senha123' };

    it('deve logar admin com credenciais corretas', async () => {
      const hashed = await bcrypt.hash('Senha123', 10);
      mockAdminService.findByUsernameWithPassword.mockResolvedValue(
        makeAdmin({ password: hashed }),
      );

      const result = await service.loginAdmin(dto);

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.user.role).toBe(UserRole.ADMIN);
    });

    it('deve lançar UnauthorizedException com senha errada', async () => {
      const hashed = await bcrypt.hash('OutraSenha123', 10);
      mockAdminService.findByUsernameWithPassword.mockResolvedValue(
        makeAdmin({ password: hashed }),
      );

      await expect(service.loginAdmin(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException se admin não existir', async () => {
      mockAdminService.findByUsernameWithPassword.mockResolvedValue(null);

      await expect(service.loginAdmin(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
