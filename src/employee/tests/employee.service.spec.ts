import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmployeeService } from '../employee.service';
import { EMPLOYEE_REPOSITORY } from '../interface/repository.interface';
import { AuditLogService } from '../../common/audit/audit-log.service';
import * as bcrypt from 'bcrypt';

const mockEmployeeRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByRegistrationId: jest.fn(),
  findByRegistrationIdWithPassword: jest.fn(),
  findByEmail: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
};

const mockAuditLogService = {
  record: jest.fn(),
};

const makeEmployee = (overrides = {}) => ({
  _id: 'employee-id-123',
  name: 'Maria Souza',
  email: 'maria@empresa.com',
  registrationId: 'MAT001',
  password: '$2b$12$hashedpassword',
  active: true,
  ...overrides,
});

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: EMPLOYEE_REPOSITORY, useValue: mockEmployeeRepository },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
    jest.clearAllMocks();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      name: 'Maria Souza',
      email: 'maria@empresa.com',
      registrationId: 'MAT001',
      password: 'Senha123',
    };

    it('deve criar employee com senha hasheada', async () => {
      mockEmployeeRepository.findByEmail.mockResolvedValue(null);
      mockEmployeeRepository.findByRegistrationId.mockResolvedValue(null);
      mockEmployeeRepository.create.mockResolvedValue(makeEmployee());

      await service.create(dto as any);

      const createCall = mockEmployeeRepository.create.mock.calls[0][0];
      expect(createCall.registrationId).toBe('MAT001');
      expect(createCall.password).not.toBe('Senha123');
      expect(createCall.password).toMatch(/^\$2b\$/); // bcrypt hash
    });

    it('deve mapear registrationId corretamente', async () => {
      mockEmployeeRepository.findByEmail.mockResolvedValue(null);
      mockEmployeeRepository.findByRegistrationId.mockResolvedValue(null);
      mockEmployeeRepository.create.mockResolvedValue(makeEmployee());

      await service.create(dto as any);

      const createCall = mockEmployeeRepository.create.mock.calls[0][0];
      expect(createCall.registrationId).toBe(dto.registrationId);
    });

    it('deve lançar ConflictException se e-mail já existir', async () => {
      mockEmployeeRepository.findByEmail.mockResolvedValue(makeEmployee());
      mockEmployeeRepository.findByRegistrationId.mockResolvedValue(null);

      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockEmployeeRepository.create).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException se matrícula já existir', async () => {
      mockEmployeeRepository.findByEmail.mockResolvedValue(null);
      mockEmployeeRepository.findByRegistrationId.mockResolvedValue(makeEmployee());

      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockEmployeeRepository.create).not.toHaveBeenCalled();
    });
  });

  // ── findOneOrFail ──────────────────────────────────────────────────────────

  describe('findOneOrFail', () => {
    it('deve retornar employee existente', async () => {
      const employee = makeEmployee();
      mockEmployeeRepository.findById.mockResolvedValue(employee);

      const result = await service.findOneOrFail('employee-id-123');
      expect(result).toEqual(employee);
    });

    it('deve lançar NotFoundException se não existir', async () => {
      mockEmployeeRepository.findById.mockResolvedValue(null);

      await expect(service.findOneOrFail('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('deve atualizar e retornar employee', async () => {
      const updated = makeEmployee({ name: 'Maria Atualizada' });
      mockEmployeeRepository.update.mockResolvedValue(updated);

      const result = await service.update('employee-id-123', {
        name: 'Maria Atualizada',
      } as any);

      expect(result.name).toBe('Maria Atualizada');
    });

    it('deve hashear nova senha ao atualizar', async () => {
      const updated = makeEmployee();
      mockEmployeeRepository.update.mockResolvedValue(updated);

      const dto = { password: 'NovaSenha123' } as any;
      await service.update('employee-id-123', dto);

      const updateCall = mockEmployeeRepository.update.mock.calls[0][1];
      expect(updateCall.password).not.toBe('NovaSenha123');
      expect(updateCall.password).toMatch(/^\$2b\$/);
    });

    it('deve lançar NotFoundException se não encontrar', async () => {
      mockEmployeeRepository.update.mockResolvedValue(null);

      await expect(
        service.update('id-inexistente', { name: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deactivate ─────────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('deve desativar e retornar mensagem', async () => {
      mockEmployeeRepository.deactivate.mockResolvedValue(true);

      const result = await service.deactivate('employee-id-123');
      expect(result.message).toBeDefined();
    });

    it('deve lançar NotFoundException se não encontrar', async () => {
      mockEmployeeRepository.deactivate.mockResolvedValue(false);

      await expect(service.deactivate('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('deve retornar lista de employees ativos', async () => {
      const employees = [makeEmployee(), makeEmployee({ registrationId: 'MAT002' })];
      mockEmployeeRepository.findAll.mockResolvedValue(employees);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });
});
