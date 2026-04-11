import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StudentService } from '../student.service';
import { STUDENT_REPOSITORY } from '../interfaces/repository.interface';
import { StudentStatus } from '../schemas/student.schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ImagesService } from '../../image/image.service';

const mockStudentRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findByEmailWithSensitiveFields: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockAuditLogService = {
  record: jest.fn(),
};

const mockImagesService = {
  findByStudentId: jest.fn(),
  create: jest.fn(),
  updateByStudentId: jest.fn(),
};

const makeStudent = (overrides = {}) => ({
  _id: 'student-id-123',
  name: 'João Silva',
  email: 'joao@test.com',
  status: StudentStatus.ACTIVE,
  active: true,
  ...overrides,
});

describe('StudentService', () => {
  let service: StudentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        { provide: STUDENT_REPOSITORY, useValue: mockStudentRepository },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: ImagesService, useValue: mockImagesService },
      ],
    }).compile();

    service = module.get<StudentService>(StudentService);
    jest.clearAllMocks();
  });

  describe('findOneOrFail', () => {
    it('deve retornar student existente', async () => {
      const student = makeStudent();
      mockStudentRepository.findById.mockResolvedValue(student);

      const result = await service.findOneOrFail('student-id-123');
      expect(result).toEqual(student);
    });

    it('deve lançar NotFoundException se não existir', async () => {
      mockStudentRepository.findById.mockResolvedValue(null);

      await expect(service.findOneOrFail('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activate', () => {
    it('deve limpar o código de verificação e ativar', async () => {
      mockStudentRepository.update.mockResolvedValue(makeStudent());

      await service.activate('student-id-123');

      expect(mockStudentRepository.update).toHaveBeenCalledWith(
        'student-id-123',
        expect.objectContaining({
          status: StudentStatus.ACTIVE,
          verificationCode: null,
          verificationCodeExpiresAt: null,
          verificationCodeAttempts: 0,
          verificationCodeLockedUntil: null,
          verificationCodeLastSentAt: null,
        }),
      );
    });
  });

  describe('update', () => {
    it('deve atualizar e retornar student', async () => {
      const updated = makeStudent({ name: 'João Atualizado' });
      mockStudentRepository.update.mockResolvedValue(updated);

      const result = await service.update('student-id-123', {
        name: 'João Atualizado',
      } as any);

      expect(result.name).toBe('João Atualizado');
    });

    it('deve lançar NotFoundException se não encontrar para update', async () => {
      mockStudentRepository.update.mockResolvedValue(null);

      await expect(
        service.update('id-inexistente', { name: 'Teste' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deve remover e retornar mensagem', async () => {
      mockStudentRepository.remove.mockResolvedValue(true);

      const result = await service.remove('student-id-123');
      expect(result.message).toBeDefined();
    });

    it('deve lançar NotFoundException se não encontrar para remover', async () => {
      mockStudentRepository.remove.mockResolvedValue(false);

      await expect(service.remove('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('deve retornar lista de students', async () => {
      const students = [makeStudent(), makeStudent({ email: 'maria@test.com' })];
      mockStudentRepository.findAll.mockResolvedValue(students);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });
});
