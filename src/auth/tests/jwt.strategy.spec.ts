import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from '../strategies/jwt.strategy';
import { StudentService } from '../../student/student.service';
import { EmployeeService } from '../../employee/employee.service';
import { AdminService } from '../../admin/admin.service';
import { UserRole } from '../../common/interfaces/user-roles.enum';
import { StudentStatus } from '../../student/schemas/student.schema';
import { JwtPayload } from '../interfaces/auth.interface';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockStudentService = { findById: jest.fn() };
const mockEmployeeService = { findById: jest.fn() };
const mockAdminService = { findById: jest.fn() };
const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('test-secret-key'),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeAccessPayload = (
  role: UserRole,
  identifier: string,
  sub = 'some-id-123',
): JwtPayload => ({ sub, role, identifier, tokenUse: 'access' });

// ── Suite ────────────────────────────────────────────────────────────────────

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

  // ── tokenUse ───────────────────────────────────────────────────────────────

  describe('tokenUse guard', () => {
    it('deve rejeitar token com tokenUse !== access', async () => {
      const payload = {
        ...makeAccessPayload(UserRole.STUDENT, 'joao@test.com'),
        tokenUse: 'refresh' as const,
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );

      // Nenhum banco deve ser consultado — rejeição acontece antes
      expect(mockStudentService.findById).not.toHaveBeenCalled();
    });
  });

  // ── STUDENT ────────────────────────────────────────────────────────────────

  describe('student payload', () => {
    const identifier = 'joao@test.com';
    const sub = 'student-id-123';
    const payload = makeAccessPayload(UserRole.STUDENT, identifier, sub);

    it('deve validar student ativo com identifier correto', async () => {
      mockStudentService.findById.mockResolvedValue({
        status: StudentStatus.ACTIVE,
        email: identifier,
      });

      const result = await strategy.validate(payload);

      expect(result).toEqual({ id: sub, role: UserRole.STUDENT, identifier });
      expect(mockStudentService.findById).toHaveBeenCalledWith(sub);
    });

    it('deve rejeitar student com status PENDING', async () => {
      mockStudentService.findById.mockResolvedValue({
        status: StudentStatus.PENDING,
        email: identifier,
      });

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve rejeitar se identifier (email) não bater com o banco', async () => {
      mockStudentService.findById.mockResolvedValue({
        status: StudentStatus.ACTIVE,
        email: 'outro@email.com', // email mudou no banco
      });

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve rejeitar se student não existir', async () => {
      mockStudentService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve rejeitar e logar erro inesperado do banco', async () => {
      mockStudentService.findById.mockRejectedValue(new Error('DB timeout'));

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── EMPLOYEE ───────────────────────────────────────────────────────────────

  describe('employee payload', () => {
    const identifier = 'MAT001';
    const sub = 'employee-id-123';
    const payload = makeAccessPayload(UserRole.EMPLOYEE, identifier, sub);

    it('deve validar employee ativo com registrationId correto', async () => {
      mockEmployeeService.findById.mockResolvedValue({
        active: true,
        registrationId: identifier,
      });

      const result = await strategy.validate(payload);

      expect(result).toEqual({ id: sub, role: UserRole.EMPLOYEE, identifier });
      expect(mockEmployeeService.findById).toHaveBeenCalledWith(sub);
    });

    it('deve rejeitar employee inativo', async () => {
      mockEmployeeService.findById.mockResolvedValue({
        active: false,
        registrationId: identifier,
      });

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve rejeitar se registrationId não bater com o banco', async () => {
      mockEmployeeService.findById.mockResolvedValue({
        active: true,
        registrationId: 'MAT999', // matrícula mudou
      });

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve rejeitar se employee não existir', async () => {
      mockEmployeeService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── ADMIN ──────────────────────────────────────────────────────────────────

  describe('admin payload', () => {
    const identifier = 'admin';
    const sub = 'admin-id-123';
    const payload = makeAccessPayload(UserRole.ADMIN, identifier, sub);

    it('deve validar admin existente com username correto', async () => {
      mockAdminService.findById.mockResolvedValue({ username: identifier });

      const result = await strategy.validate(payload);

      expect(result).toEqual({ id: sub, role: UserRole.ADMIN, identifier });
      expect(mockAdminService.findById).toHaveBeenCalledWith(sub);
    });

    it('deve rejeitar se username não bater com o banco', async () => {
      mockAdminService.findById.mockResolvedValue({ username: 'outro-admin' });

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve rejeitar se admin não existir', async () => {
      mockAdminService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── Role inválida ──────────────────────────────────────────────────────────

  it('deve rejeitar payload com role inválida', async () => {
    const payload = makeAccessPayload('hacker' as UserRole, 'x');

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
