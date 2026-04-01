import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { StudentService } from '../../student/student.service';
import { EmployeeService } from '../../employee/employee.service';
import { AdminService } from '../../admin/admin.service';
import { UserRole } from '../../common/interfaces/user-roles.enum';
import { StudentStatus } from '../../student/schemas/student.schema';

const mockStudentService = { findByEmail: jest.fn() };
const mockEmployeeService = { findByMatricula: jest.fn() };
const mockAdminService = { findByUsername: jest.fn() };
const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('test-secret-key'),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StudentService, useValue: mockStudentService },
        { provide: EmployeeService, useValue: mockEmployeeService },
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    jest.clearAllMocks();
  });

  // ── STUDENT ────────────────────────────────────────────────────────────────

  describe('student payload', () => {
    const payload = {
      sub: 'student-id-123',
      role: UserRole.STUDENT,
      identifier: 'joao@test.com',
    };

    it('deve validar student ativo', async () => {
      mockStudentService.findByEmail.mockResolvedValue({
        status: StudentStatus.ACTIVE,
      });

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'student-id-123',
        role: UserRole.STUDENT,
        identifier: 'joao@test.com',
      });
    });

    it('deve rejeitar student com status PENDING', async () => {
      mockStudentService.findByEmail.mockResolvedValue({
        status: StudentStatus.PENDING,
      });

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve rejeitar se student não existir', async () => {
      mockStudentService.findByEmail.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── EMPLOYEE ───────────────────────────────────────────────────────────────

  describe('employee payload', () => {
    const payload = {
      sub: 'employee-id-123',
      role: UserRole.EMPLOYEE,
      identifier: 'MAT001',
    };

    it('deve validar employee ativo', async () => {
      mockEmployeeService.findByMatricula.mockResolvedValue({ active: true });

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'employee-id-123',
        role: UserRole.EMPLOYEE,
        identifier: 'MAT001',
      });
    });

    it('deve rejeitar employee inativo', async () => {
      mockEmployeeService.findByMatricula.mockResolvedValue({ active: false });

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve rejeitar se employee não existir', async () => {
      mockEmployeeService.findByMatricula.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── ADMIN ──────────────────────────────────────────────────────────────────

  describe('admin payload', () => {
    const payload = {
      sub: 'admin-id-123',
      role: UserRole.ADMIN,
      identifier: 'admin',
    };

    it('deve validar admin existente', async () => {
      mockAdminService.findByUsername.mockResolvedValue({ username: 'admin' });

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'admin-id-123',
        role: UserRole.ADMIN,
        identifier: 'admin',
      });
    });

    it('deve rejeitar se admin não existir', async () => {
      mockAdminService.findByUsername.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── Role inválida ──────────────────────────────────────────────────────────

  it('deve rejeitar payload com role inválida', async () => {
    const payload = {
      sub: 'any-id',
      role: 'hacker' as any,
      identifier: 'x',
    };

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
