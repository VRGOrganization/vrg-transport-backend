import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LicenseService } from './license.service';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { StudentService } from '../student/student.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { MailService } from '../mail/mail.service';
import { LICENSE_REQUEST_REPOSITORY } from '../license-request/interfaces/repository.interface';
import { LicenseRequestStatus } from '../license-request/schemas/license-request.schema';

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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('dynamic expiration months (TDD)', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ image: 'base64-image' }),
      });
    });

    it('deve usar os meses informados ao criar licenca', async () => {
      await (service as any).create(
        {
          id: 'student-id-123',
          institution: 'IF',
          bus: 'A01',
          photo: 'data:image/png;base64,AAAA',
        },
        'employee-1',
        4,
      );

      const payload = mockLicenseRepository.create.mock.calls[0][0];
      const expiration = new Date(payload.expirationDate);
      const now = new Date();
      const monthDiff =
        (expiration.getFullYear() - now.getFullYear()) * 12 +
        (expiration.getMonth() - now.getMonth());

      expect(monthDiff).toBeGreaterThanOrEqual(4);
      expect(monthDiff).toBeLessThanOrEqual(5);
    });

    it('deve usar os meses informados ao regenerar licenca existente', async () => {
      mockLicenseRepository.findOneByStudentId.mockResolvedValue({
        _id: { toString: () => 'license-id-1' },
        studentId: 'student-id-123',
      });
      mockLicenseRepository.update.mockResolvedValue({
        _id: { toString: () => 'license-id-1' },
      });

      await (service as any).regenerateExistingForStudent(
        'student-id-123',
        {
          institution: 'IF',
          bus: 'A01',
          photo: 'data:image/png;base64,AAAA',
        },
        'employee-1',
        9,
      );

      const payload = mockLicenseRepository.update.mock.calls[0][1];
      const expiration = new Date(payload.expirationDate);
      const now = new Date();
      const monthDiff =
        (expiration.getFullYear() - now.getFullYear()) * 12 +
        (expiration.getMonth() - now.getMonth());

      expect(monthDiff).toBeGreaterThanOrEqual(9);
      expect(monthDiff).toBeLessThanOrEqual(10);
    });
  });

  describe('license api response parsing', () => {
    it('deve converter multipart/form-data em base64 para persistencia', async () => {
      const boundary = 'license-boundary';
      const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
      const multipartBody = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\n` +
            'Content-Disposition: form-data; name="image"; filename="license.jpg"\r\n' +
            'Content-Type: image/jpeg\r\n\r\n',
        ),
        imageBytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((name: string) =>
            name.toLowerCase() === 'content-type'
              ? `multipart/form-data; boundary=${boundary}`
              : null,
          ),
        },
        arrayBuffer: async () =>
          multipartBody.buffer.slice(
            multipartBody.byteOffset,
            multipartBody.byteOffset + multipartBody.byteLength,
          ),
      });

      const result = await (service as any).callLicenseApi({ foo: 'bar' });

      expect(result).toEqual({
        image: imageBytes.toString('base64'),
      });
    });
  });
});
