import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../common/audit/audit-log.service';
import { EnrollmentPeriodService } from '../enrollment-period/enrollment-period.service';
import { ImagesService } from '../image/image.service';
import { BusService } from '../bus/bus.service';
import { LICENSE_REQUEST_REPOSITORY } from './interfaces/repository.interface';
import { LicenseRequestService } from './license-request.service';
import {
  LicenseRequestStatus,
  type LicenseRequest,
} from './schemas/license-request.schema';
import { LicenseService } from '../license/license.service';
import { MailService } from '../mail/mail.service';
import { StudentService } from '../student/student.service';
import { PhotoType } from '../image/types/photoType.enum';

const mockRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByStudentId: jest.fn(),
  findPendingByStudentId: jest.fn(),
  findAll: jest.fn(),
  findAllByStatus: jest.fn(),
  findWaitlistedByEnrollmentPeriod: jest.fn(),
  update: jest.fn(),
};

const mockStudentService = {
  findOneOrFail: jest.fn(),
  createOrUpdateImage: jest.fn(),
};

const mockLicenseService = {
  create: jest.fn(),
  regenerateExistingForStudent: jest.fn(),
};

const mockImagesService = {
  findByStudentId: jest.fn(),
  archiveToHistory: jest.fn(),
};

const mockMailService = {
  sendLicenseRejection: jest.fn(),
  sendDocumentUpdateRejected: jest.fn(),
  sendDocumentUpdateApproved: jest.fn(),
  sendWaitlistConfirmation: jest.fn(),
  sendWaitlistPromotion: jest.fn(),
};

const mockAuditLog = {
  record: jest.fn(),
};

const mockEnrollmentPeriodService = {
  getActive: jest.fn(),
  findById: jest.fn(),
  incrementFilled: jest.fn(),
  decrementFilled: jest.fn(),
  reserveWaitlistPosition: jest.fn(),
};

const mockBusService = {
  incrementUniversityFilledSlots: jest.fn(),
  decrementUniversityFilledSlots: jest.fn(),
};

const makeRequest = (
  overrides: Partial<LicenseRequest> = {},
): LicenseRequest =>
  ({
    studentId: 'student-1',
    type: 'initial',
    status: LicenseRequestStatus.PENDING,
    rejectionReason: null,
    cancellationReason: null,
    rejectedAt: null,
    approvedByEmployeeId: null,
    rejectedByEmployeeId: null,
    licenseId: null,
    pendingImages: [],
    changedDocuments: [],
    ...overrides,
  }) as LicenseRequest;

describe('LicenseRequestService (TDD enrollment period rules)', () => {
  let service: LicenseRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseRequestService,
        { provide: LICENSE_REQUEST_REPOSITORY, useValue: mockRepository },
        {
          provide: EnrollmentPeriodService,
          useValue: mockEnrollmentPeriodService,
        },
        { provide: BusService, useValue: mockBusService },
        { provide: StudentService, useValue: mockStudentService },
        { provide: LicenseService, useValue: mockLicenseService },
        { provide: ImagesService, useValue: mockImagesService },
        { provide: MailService, useValue: mockMailService },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<LicenseRequestService>(LicenseRequestService);

    jest.clearAllMocks();
    mockStudentService.findOneOrFail.mockResolvedValue({ email: 'student@mail.com', name: 'Aluno Teste', universityId: null });
  });

  describe('createRequest', () => {
    it('deve rejeitar quando ja existir request waitlisted', async () => {
      mockRepository.findByStudentId.mockResolvedValue([
        makeRequest({ status: 'waitlisted' as any }),
      ]);

      await expect(service.createRequest('student-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve rejeitar quando nao existir periodo ativo', async () => {
      mockRepository.findByStudentId.mockResolvedValue([]);
      mockEnrollmentPeriodService.getActive.mockResolvedValue(null);

      await expect(service.createRequest('student-1')).rejects.toThrow(
        'Inscrições encerradas. Aguarde a abertura de um novo período.',
      );
    });

    it('deve criar request pendente quando houver vagas', async () => {
      const now = new Date();
      mockRepository.findByStudentId.mockResolvedValue([]);
      mockEnrollmentPeriodService.getActive.mockResolvedValue({
        _id: 'period-1',
        startDate: new Date(now.getTime() - 60_000),
        endDate: new Date(now.getTime() + 60_000),
        totalSlots: 10,
        filledSlots: 3,
      });
      mockRepository.create.mockResolvedValue(
        makeRequest({
          status: LicenseRequestStatus.PENDING,
          enrollmentPeriodId: 'period-1' as any,
        } as any),
      );

      const result = (await service.createRequest('student-1')) as any;

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: LicenseRequestStatus.PENDING,
          enrollmentPeriodId: 'period-1',
        }),
      );
      expect(result.waitlisted).toBe(false);
    });

    it('deve criar waitlisted quando nao houver vagas e enviar email', async () => {
      const now = new Date();
      mockRepository.findByStudentId.mockResolvedValue([]);
      mockEnrollmentPeriodService.getActive.mockResolvedValue({
        _id: 'period-1',
        startDate: new Date(now.getTime() - 60_000),
        endDate: new Date(now.getTime() + 60_000),
        totalSlots: 1,
        filledSlots: 1,
      });
      mockEnrollmentPeriodService.reserveWaitlistPosition.mockResolvedValue(3);
      mockStudentService.findOneOrFail.mockResolvedValue({
        email: 'student@mail.com',
        name: 'Aluno Teste',
      });
      mockRepository.create.mockResolvedValue(
        makeRequest({
          status: 'waitlisted' as any,
          enrollmentPeriodId: 'period-1' as any,
          filaPosition: 3 as any,
        } as any),
      );

      const result = (await service.createRequest('student-1')) as any;

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'waitlisted',
          filaPosition: 3,
        }),
      );
      expect(mockMailService.sendWaitlistConfirmation).toHaveBeenCalledWith(
        'student@mail.com',
        'Aluno Teste',
        3,
      );
      expect(result.waitlisted).toBe(true);
      expect(result.filaPosition).toBe(3);
    });
  });

  describe('approve', () => {
    it('deve incrementar vagas preenchidas apos aprovar request com periodo vinculado', async () => {
      mockRepository.findById.mockResolvedValue(
        makeRequest({
          type: 'initial',
          status: LicenseRequestStatus.PENDING,
          enrollmentPeriodId: 'period-1' as any,
        } as any),
      );
      mockEnrollmentPeriodService.findById.mockResolvedValue({
        _id: 'period-1',
        licenseValidityMonths: 8,
      });
      mockLicenseService.create.mockResolvedValue({
        _id: { toString: () => 'license-1' },
      });
      mockRepository.update.mockResolvedValue(
        makeRequest({ status: LicenseRequestStatus.APPROVED }),
      );

      await service.approve('request-1', 'employee-1', {
        bus: 'A01',
        institution: 'IF',
      });

      expect(mockLicenseService.create).toHaveBeenCalledWith(
        expect.anything(),
        'employee-1',
        8,
        'period-1',
        true,
      );
      expect(mockEnrollmentPeriodService.incrementFilled).toHaveBeenCalledWith(
        'period-1',
      );
    });

      it('deve incrementar filledSlots do ônibus quando request inicial tem busId e universityId', async () => {
        mockRepository.findById.mockResolvedValue(
          makeRequest({
            type: 'initial',
            status: LicenseRequestStatus.PENDING,
            enrollmentPeriodId: 'period-1' as any,
            busId: 'bus-1' as any,
            universityId: 'uni-1' as any,
          } as any),
        );
        mockEnrollmentPeriodService.findById.mockResolvedValue({
          _id: 'period-1',
          licenseValidityMonths: 6,
        });
        mockLicenseService.create.mockResolvedValue({ _id: { toString: () => 'license-1' } });
        mockRepository.update.mockResolvedValue(makeRequest({ status: LicenseRequestStatus.APPROVED }));

        await service.approve('request-1', 'employee-1', { bus: 'A01', institution: 'IF' });

        expect(mockEnrollmentPeriodService.incrementFilled).toHaveBeenCalledWith('period-1');
        expect(mockBusService.incrementUniversityFilledSlots).toHaveBeenCalledWith('bus-1', 'uni-1');
      });

      it('deve reverter incremento do ônibus se a criação da licença falhar', async () => {
        mockRepository.findById.mockResolvedValue(
          makeRequest({
            type: 'initial',
            status: LicenseRequestStatus.PENDING,
            enrollmentPeriodId: 'period-1' as any,
            busId: 'bus-1' as any,
            universityId: 'uni-1' as any,
          } as any),
        );
        mockEnrollmentPeriodService.findById.mockResolvedValue({ _id: 'period-1', licenseValidityMonths: 6 });
        mockLicenseService.create.mockRejectedValue(new Error('creation failed'));

        await expect(service.approve('request-1', 'employee-1', { bus: 'A01', institution: 'IF' })).rejects.toThrow();

        expect(mockEnrollmentPeriodService.decrementFilled).toHaveBeenCalledWith('period-1');
        expect(mockBusService.decrementUniversityFilledSlots).toHaveBeenCalledWith('bus-1', 'uni-1');
      });

    it('deve manter aprovacao mesmo se email de update falhar', async () => {
      mockRepository.findById.mockResolvedValue(
        makeRequest({
          type: 'update',
          status: LicenseRequestStatus.PENDING,
          changedDocuments: [PhotoType.ProfilePhoto],
          pendingImages: [
            {
              photoType: PhotoType.ProfilePhoto,
              dataUrl: 'data:image/png;base64,AAAA',
            },
          ],
        }),
      );
      mockImagesService.findByStudentId.mockResolvedValue([
        {
          _id: { toString: () => 'img-1' },
          photoType: PhotoType.ProfilePhoto,
        },
      ]);
      mockLicenseService.regenerateExistingForStudent.mockResolvedValue({
        _id: { toString: () => 'license-2' },
      });
      mockRepository.update.mockResolvedValue(
        makeRequest({ status: LicenseRequestStatus.APPROVED, type: 'update' }),
      );
      mockStudentService.findOneOrFail.mockResolvedValue({
        email: 'student@mail.com',
        name: 'Aluno',
      });
      mockMailService.sendDocumentUpdateApproved.mockRejectedValue(
        new Error('mail down'),
      );

      await expect(
        service.approve('request-2', 'employee-1', {
          bus: 'A01',
          institution: 'IF',
        }),
      ).resolves.toBeDefined();

      expect(mockRepository.update).toHaveBeenCalledWith(
        'request-2',
        expect.objectContaining({ status: LicenseRequestStatus.APPROVED }),
      );
    });
  });
});
