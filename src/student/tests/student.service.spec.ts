import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StudentService } from '../student.service';
import { STUDENT_REPOSITORY } from '../interfaces/repository.interface';
import { StudentStatus } from '../schemas/student.schema';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { ImagesService } from '../../image/image.service';
import { BusService } from '../../bus/bus.service';

const mockStudentRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findByEmailWithSensitiveFields: jest.fn(),
  findByBus: jest.fn(),
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

const mockBusService = {
  findOneOrFail: jest.fn(),
  findByIdentifier: jest.fn(),
};

const makeStudent = (overrides = {}) => ({
  _id: 'student-id-123',
  name: 'João Silva',
  email: 'joao@test.com',
  status: StudentStatus.ACTIVE,
  active: true,
  hasCompletedInitialEnrollment: false,
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
        { provide: BusService, useValue: mockBusService },
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

  describe('submitLicenseRequest', () => {
    it('deve exigir GovernmentId e ProofOfResidence na primeira inscricao', async () => {
      mockStudentRepository.findById.mockResolvedValue(makeStudent());

      await expect(
        service.submitLicenseRequest(
          'student-id-123',
          {
            schedule: [{ day: 'SEG', period: 'Manhã' }] as any,
          } as any,
          {
            ProfilePhoto: [{ buffer: Buffer.from('img'), mimetype: 'image/jpeg' }] as any,
            EnrollmentProof: [{ buffer: Buffer.from('img'), mimetype: 'application/pdf' }] as any,
            CourseSchedule: [{ buffer: Buffer.from('img'), mimetype: 'application/pdf' }] as any,
          },
        ),
      ).rejects.toThrow('Envie o documento de identidade para a primeira inscrição.');

      expect(mockStudentRepository.update).not.toHaveBeenCalled();
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

  describe('findByBusId', () => {
    it('deve resolver o bus e buscar alunos pela secondaryBusId', async () => {
      mockBusService.findOneOrFail.mockResolvedValue({
        _id: { toString: () => 'bus-id-123' },
        identifier: 'BUS-42',
      });
      mockStudentRepository.findByBus.mockResolvedValue([makeStudent()]);

      const result = await service.findByBusId('bus-id-123');

      expect(mockBusService.findOneOrFail).toHaveBeenCalledWith('bus-id-123');
      expect(mockStudentRepository.findByBus).toHaveBeenCalledWith('bus-id-123');
      expect(result).toHaveLength(1);
    });
  });
});
