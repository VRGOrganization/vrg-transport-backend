import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { StudentService } from '../student/student.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { MailService } from '../mail/mail.service';
import { LICENSE_REQUEST_REPOSITORY } from '../license-request/interfaces/repository.interface';

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
  sendRejectionEmail: jest.fn(),
};

const mockLicenseRequestRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByStudentId: jest.fn().mockResolvedValue([]),
  findPendingByStudentId: jest.fn(),
  findAll: jest.fn(),
  findAllByStatus: jest.fn(),
  update: jest.fn(),
};

describe('LicenseController', () => {
  let controller: LicenseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LicenseController],
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

    controller = module.get<LicenseController>(LicenseController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});