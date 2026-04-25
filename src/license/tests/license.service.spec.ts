import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LicenseService } from '../license.service';
import { LICENSE_REPOSITORY } from '../interfaces/repository.interface';
import { LicenseStatus } from '../schemas/license.schema';
import { StudentService } from '../../student/student.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { MailService } from '../../mail/mail.service';
import { LICENSE_REQUEST_REPOSITORY } from '../../license-request/interfaces/repository.interface';
import { LicenseRequestStatus } from '../../license-request/schemas/license-request.schema';

// Mock global fetch
global.fetch = jest.fn();

const mockLicenseRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findOneByStudentId: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    const config: Record<string, string> = {
      LICENSE_API_URL: 'https://mock-license-api.com',
      LICENSE_API_KEY: 'mock-api-key',
      QR_CODE_BASE_URL: 'https://mock-license-api.com/qr',
    };
    const value = config[key];
    if (!value) throw new Error(`Config ${key} not found`);
    return value;
  }),
  get: jest.fn((_key: string, fallback: number) => fallback),
};

const mockStudentService = {
  findOneOrFail: jest.fn().mockResolvedValue({
    _id: 'student-id-123',
    name: 'Joao Silva',
    degree: 'CC',
    shift: 'Noturno',
    telephone: '11999999999',
    bloodType: 'A+',
  }),
};

const mockAuditLogService = {
  record: jest.fn(),
};

const mockMailService = {
  sendVerificationCode: jest.fn(),
  sendRejectionEmail: jest.fn(),
};

const mockLicenseRequestRepository = {
  findByStudentId: jest
    .fn()
    .mockResolvedValue([{ status: LicenseRequestStatus.APPROVED }]),
};

const makeLicense = (overrides = {}) => ({
  _id: 'license-id-123',
  studentId: 'student-id-123',
  employeeId: 'employee-id-123',
  imageLicense: 'https://image.url/license.png',
  qrCodeUrl: 'https://mock-license-api.com/qr/mock-verification-code',
  status: LicenseStatus.ACTIVE,
  existing: true,
  expirationDate: new Date(),
  ...overrides,
});

const mockFetchSuccess = (imageUrl = 'https://image.url/license.png') => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ image: imageUrl }),
  });
};

describe('LicenseService', () => {
  let service: LicenseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseService,
        { provide: LICENSE_REPOSITORY, useValue: mockLicenseRepository },
        {
          provide: LICENSE_REQUEST_REPOSITORY,
          useValue: mockLicenseRequestRepository,
        },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StudentService, useValue: mockStudentService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<LicenseService>(LicenseService);
    jest.clearAllMocks();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      id: 'student-id-123',
      name: 'João Silva',
      degree: 'CC',
      institution: 'UFMG',
      shift: 'Noturno',
      telephone: '11999999999',
      blood_type: 'A+',
      bus: 'Linha 1',
      photo: 'base64photo',
    };

    it('deve criar licença com employeeId do token', async () => {
      mockFetchSuccess();
      mockLicenseRepository.create.mockResolvedValue(makeLicense());

      await service.create(dto as any, 'employee-id-from-token');

      const createCall = mockLicenseRepository.create.mock.calls[0][0];
      expect(createCall.employeeId).toBe('employee-id-from-token');
      expect(createCall.studentId).toBe('student-id-123');
      expect(createCall.status).toBe(LicenseStatus.ACTIVE);
      expect(createCall.qrCodeUrl).toMatch(
        /^https:\/\/mock-license-api\.com\/qr\/.+/,
      );
    });

    it('deve lançar BadGatewayException se API externa falhar', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        service.create(dto as any, 'employee-id-123'),
      ).rejects.toThrow(BadGatewayException);

      expect(mockLicenseRepository.create).not.toHaveBeenCalled();
    });

    it('deve passar X-API-KEY no header da requisição externa', async () => {
      mockFetchSuccess();
      mockLicenseRepository.create.mockResolvedValue(makeLicense());

      await service.create(dto as any, 'employee-id-123');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers['X-API-KEY']).toBe('mock-api-key');
    });
  });

  // ── getLicenseByStudentId ──────────────────────────────────────────────────

  describe('getLicenseByStudentId', () => {
    it('deve retornar licença pelo studentId', async () => {
      const license = makeLicense();
      mockLicenseRepository.findOneByStudentId.mockResolvedValue(license);

      const result = await service.getLicenseByStudentId('student-id-123');
      expect(result).toEqual(license);
    });

    it('deve lançar NotFoundException se não existir', async () => {
      mockLicenseRepository.findOneByStudentId.mockResolvedValue(null);

      await expect(
        service.getLicenseByStudentId('id-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getLicenseById ─────────────────────────────────────────────────────────

  describe('getLicenseById', () => {
    it('deve retornar licença pelo id', async () => {
      const license = makeLicense();
      mockLicenseRepository.findOne.mockResolvedValue(license);

      const result = await service.getLicenseById('license-id-123');
      expect(result).toEqual(license);
    });

    it('deve lançar NotFoundException se não existir', async () => {
      mockLicenseRepository.findOne.mockResolvedValue(null);

      await expect(service.getLicenseById('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deve remover e retornar mensagem', async () => {
      mockLicenseRepository.remove.mockResolvedValue(true);

      const result = await service.remove('license-id-123');
      expect(result.message).toBeDefined();
    });

    it('deve lançar NotFoundException se não existir', async () => {
      mockLicenseRepository.remove.mockResolvedValue(false);

      await expect(service.remove('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto = {
      name: 'João',
      degree: 'CC',
      institution: 'UFMG',
      shift: 'Noturno',
      telephone: '11999999999',
      blood_type: 'A+',
      bus: 'Linha 1',
      photo: 'base64',
    };

    it('deve atualizar a licença existente sem exigir id no body', async () => {
      mockFetchSuccess();
      mockLicenseRepository.findOne.mockResolvedValue(makeLicense());
      mockLicenseRepository.update.mockResolvedValue(makeLicense());

      const result = await service.update(
        'old-license-id',
        dto as any,
        'employee-id-123',
      );

      expect(mockLicenseRepository.update).toHaveBeenCalledTimes(1);
      expect(mockLicenseRepository.update).toHaveBeenCalledWith(
        'old-license-id',
        expect.objectContaining({
          studentId: 'student-id-123',
          employeeId: 'employee-id-123',
          status: LicenseStatus.ACTIVE,
        }),
      );
      expect(result).toBeDefined();
    });

    it('deve lançar NotFoundException se a licença não existir', async () => {
      mockLicenseRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('old-license-id', dto as any, 'employee-id-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('não deve atualizar se a API externa falhar', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      mockLicenseRepository.findOne.mockResolvedValue(makeLicense());

      await expect(
        service.update('old-license-id', dto as any, 'employee-id-123'),
      ).rejects.toThrow(BadGatewayException);

      expect(mockLicenseRepository.update).not.toHaveBeenCalled();
    });
  });

  // ── getAll ─────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('deve retornar todas as licenças ativas', async () => {
      const licenses = [makeLicense(), makeLicense({ studentId: 'stu-2' })];
      mockLicenseRepository.findAll.mockResolvedValue(licenses);

      const result = await service.getAll();
      expect(result).toHaveLength(2);
    });
  });
});
