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
  LicenseRequestType,
} from './schemas/license-request.schema';
import { LicenseService } from '../license/license.service';
import { MailService } from '../mail/mail.service';
import { StudentService } from '../student/student.service';
import { PhotoType } from '../image/types/photoType.enum';
import { BusRouteService } from '../bus-route/bus-route.service';

const mockRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByStudentId: jest.fn(),
  findPendingByStudentId: jest.fn(),
  findAll: jest.fn(),
  findAllByStatus: jest.fn(),
  findWaitlistedByEnrollmentPeriod: jest.fn(),
  countWaitlistedByEnrollmentPeriod: jest.fn(),
  findWaitlistedByEnrollmentPeriodAndBus: jest.fn(),
  countWaitlistedByEnrollmentPeriodAndBus: jest.fn(),
  hasActiveDemandForBusAndUniversity: jest.fn(),
  update: jest.fn(),
};

const mockStudentService = {
  findOneOrFail: jest.fn(),
  createOrUpdateImage: jest.fn(),
  update: jest.fn(),
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
  findByUniversityId: jest.fn(),
  findAllByUniversityId: jest.fn(),
  findByUniversityIdAndShift: jest.fn(),
  findByIdentifier: jest.fn(),
  findOneOrFail: jest.fn(),
};

const mockBusRouteService = {
  findOneOrFail: jest.fn(),
};

const setBusRouting = (bus: any, allBuses?: any[]) => {
  mockBusService.findAllByUniversityId.mockResolvedValue(allBuses ?? [bus]);
  mockBusService.findByUniversityIdAndShift.mockResolvedValue(bus);
  mockBusService.findByIdentifier.mockResolvedValue(bus);
  mockBusService.findOneOrFail.mockResolvedValue(bus);
};

const makeRequest = (
  overrides: Partial<LicenseRequest> = {},
): LicenseRequest =>
  ({
    studentId: 'student-1',
    type: LicenseRequestType.INITIAL,
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
        { provide: BusRouteService, useValue: mockBusRouteService },
        { provide: StudentService, useValue: mockStudentService },
        { provide: LicenseService, useValue: mockLicenseService },
        { provide: ImagesService, useValue: mockImagesService },
        { provide: MailService, useValue: mockMailService },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<LicenseRequestService>(LicenseRequestService);

    jest.clearAllMocks();
    mockBusService.findByIdentifier.mockResolvedValue({
      _id: '0000000000000000000000aa',
      identifier: 'A01',
      universitySlots: [],
    });
    mockBusRouteService.findOneOrFail.mockResolvedValue({
      _id: 'route-1',
      lineNumber: 'A01',
    });
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
      mockStudentService.findOneOrFail.mockResolvedValue({ email: 'student@mail.com', name: 'Aluno Teste', universityId: '000000000000000000000002' });
      setBusRouting({ _id: '000000000000000000000001', identifier: 'A01', capacity: undefined, universitySlots: [{ universityId: '000000000000000000000002', priorityOrder: 1, filledSlots: 0 }] });
      mockStudentService.findOneOrFail.mockResolvedValue({ email: 'student@mail.com', name: 'Aluno Teste', universityId: '000000000000000000000002' });
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
      // Simulate that there are already 2 waitlisted for this bus -> new position will be 3
      mockRepository.countWaitlistedByEnrollmentPeriod.mockResolvedValue(2);
      mockStudentService.findOneOrFail.mockResolvedValue({ email: 'student@mail.com', name: 'Aluno Teste', universityId: '000000000000000000000002' });
      // bus with capacity 1 already full
      setBusRouting({ _id: '000000000000000000000001', identifier: 'A01', capacity: 1, universitySlots: [{ universityId: '000000000000000000000002', priorityOrder: 1, filledSlots: 1 }] });
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

    it('deve criar PENDING quando ônibus não tem capacity definida', async () => {
      const now = new Date();
      mockRepository.findByStudentId.mockResolvedValue([]);
      mockEnrollmentPeriodService.getActive.mockResolvedValue({
        _id: 'period-1',
        startDate: new Date(now.getTime() - 60_000),
        endDate: new Date(now.getTime() + 60_000),
        totalSlots: 10,
        filledSlots: 0,
      });
      // student is from uni-2 (use valid ObjectId strings)
      mockStudentService.findOneOrFail.mockResolvedValue({ email: 'student@mail.com', name: 'Aluno Teste', universityId: '000000000000000000000002' });

      setBusRouting({
        _id: '000000000000000000000001',
        identifier: 'A01',
        capacity: undefined,
        universitySlots: [
          { universityId: '000000000000000000000002', priorityOrder: 1, filledSlots: 0 },
        ],
      });

      mockRepository.create.mockResolvedValue(
        makeRequest({ status: LicenseRequestStatus.PENDING, enrollmentPeriodId: 'period-1' as any } as any),
      );

      const result = (await service.createRequest('student-1')) as any;

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: LicenseRequestStatus.PENDING }),
      );
      expect(result.waitlisted).toBe(false);
    });

    it('deve criar WAITLISTED quando ônibus está cheio pela soma dos filledSlots >= capacity', async () => {
      const now = new Date();
      mockRepository.findByStudentId.mockResolvedValue([]);
      mockEnrollmentPeriodService.getActive.mockResolvedValue({
        _id: 'period-1',
        startDate: new Date(now.getTime() - 60_000),
        endDate: new Date(now.getTime() + 60_000),
        totalSlots: 10,
        filledSlots: 0,
      });
      mockStudentService.findOneOrFail.mockResolvedValue({ email: 'student@mail.com', name: 'Aluno Teste', universityId: '000000000000000000000002' });

      // bus capacity 2 but filledSlots sum is 2
      setBusRouting({
        _id: '000000000000000000000001',
        identifier: 'A01',
        capacity: 2,
        universitySlots: [
          { universityId: '000000000000000000000011', priorityOrder: 1, filledSlots: 1 },
          { universityId: '000000000000000000000002', priorityOrder: 2, filledSlots: 1 },
        ],
      });

      // Simulate that there are already 3 waitlisted for this bus -> new position will be 4
      mockRepository.countWaitlistedByEnrollmentPeriod.mockResolvedValue(3);
      mockRepository.create.mockResolvedValue(
        makeRequest({ status: 'waitlisted' as any, enrollmentPeriodId: 'period-1' as any, filaPosition: 4 as any } as any),
      );

      const result = (await service.createRequest('student-1')) as any;

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'waitlisted' }),
      );
      expect(mockMailService.sendWaitlistConfirmation).toHaveBeenCalled();
      expect(result.waitlisted).toBe(true);
    });

    it('deve criar WAITLISTED quando houver demanda ativa de faculdade com prioridade superior', async () => {
      const now = new Date();
      mockRepository.findByStudentId.mockResolvedValue([]);
      mockEnrollmentPeriodService.getActive.mockResolvedValue({
        _id: 'period-1',
        startDate: new Date(now.getTime() - 60_000),
        endDate: new Date(now.getTime() + 60_000),
        totalSlots: 10,
        filledSlots: 0,
      });
      // student belongs to uni-2 which is priorityOrder 2
      mockStudentService.findOneOrFail.mockResolvedValue({ email: 'student@mail.com', name: 'Aluno Teste', universityId: '000000000000000000000002' });

      setBusRouting({
        _id: '000000000000000000000001',
        identifier: 'A01',
        capacity: 5,
        universitySlots: [
          { universityId: '000000000000000000000011', priorityOrder: 1, filledSlots: 0 }, // higher priority
          { universityId: '000000000000000000000002', priorityOrder: 2, filledSlots: 0 }, // student's uni
        ],
      });

      // Simulate that uni-1 has active demand on this bus
      mockRepository.hasActiveDemandForBusAndUniversity.mockResolvedValue(true);
      // Simulate that there are already 6 waitlisted for this bus -> new position will be 7
      mockRepository.countWaitlistedByEnrollmentPeriod.mockResolvedValue(6);
      mockRepository.create.mockResolvedValue(
        makeRequest({ status: 'waitlisted' as any, enrollmentPeriodId: 'period-1' as any, filaPosition: 7 as any } as any),
      );

      const result = (await service.createRequest('student-1')) as any;

      expect(mockRepository.hasActiveDemandForBusAndUniversity).toHaveBeenCalledWith('A01', '000000000000000000000011');
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'waitlisted' }));
      expect(result.waitlisted).toBe(true);
    });
  });

  describe('approve', () => {
    it('deve incrementar vagas preenchidas apos aprovar request com periodo vinculado', async () => {
      mockRepository.findById.mockResolvedValue(
        makeRequest({
            type: LicenseRequestType.INITIAL,
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
      mockStudentService.update.mockResolvedValue({
        hasCompletedInitialEnrollment: true,
      });

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
        undefined,
        expect.objectContaining({
          cardNote: null,
          accessBusIdentifiers: ['A01'],
        }),
      );
      expect(mockEnrollmentPeriodService.incrementFilled).toHaveBeenCalledWith(
        'period-1',
      );
      expect(mockStudentService.update).toHaveBeenCalledWith(
        'student-1',
        { hasCompletedInitialEnrollment: true },
      );
    });

      it('deve incrementar filledSlots do ônibus quando request inicial tem busId e universityId', async () => {
        mockRepository.findById.mockResolvedValue(
          makeRequest({
            type: LicenseRequestType.INITIAL,
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
        expect(mockBusService.incrementUniversityFilledSlots).toHaveBeenCalledWith('0000000000000000000000aa', 'uni-1');
      });

      it('deve reverter incremento do ônibus se a criação da licença falhar', async () => {
        mockRepository.findById.mockResolvedValue(
          makeRequest({
            type: LicenseRequestType.INITIAL,
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
      expect(mockBusService.decrementUniversityFilledSlots).toHaveBeenCalledWith('0000000000000000000000aa', 'uni-1');
      });

    it('deve marcar a primeira inscricao como concluida ao aprovar INITIAL', async () => {
      mockRepository.findById.mockResolvedValue(
        makeRequest({
          type: LicenseRequestType.INITIAL,
          status: LicenseRequestStatus.PENDING,
        }),
      );
      mockLicenseService.create.mockResolvedValue({
        _id: { toString: () => 'license-1' },
      });
      mockRepository.update.mockResolvedValue(
        makeRequest({ status: LicenseRequestStatus.APPROVED }),
      );
      mockStudentService.update.mockResolvedValue({
        hasCompletedInitialEnrollment: true,
      });

      await service.approve('request-1', 'employee-1', {
        bus: 'A01',
        institution: 'IF',
      });

      expect(mockStudentService.update).toHaveBeenCalledWith(
        'student-1',
        { hasCompletedInitialEnrollment: true },
      );
    });

    it('deve aprovar usando busRouteId e resolver o onibus pelo numero da rota', async () => {
      mockRepository.findById.mockResolvedValue(
        makeRequest({
          type: LicenseRequestType.INITIAL,
          status: LicenseRequestStatus.PENDING,
          enrollmentPeriodId: 'period-1' as any,
        } as any),
      );
      mockEnrollmentPeriodService.findById.mockResolvedValue({
        _id: 'period-1',
        licenseValidityMonths: 6,
      });
      mockBusRouteService.findOneOrFail.mockResolvedValue({
        _id: 'route-1',
        lineNumber: 'A01',
      });
      mockLicenseService.create.mockResolvedValue({
        _id: { toString: () => 'license-1' },
      });
      mockRepository.update.mockResolvedValue(
        makeRequest({ status: LicenseRequestStatus.APPROVED }),
      );
      mockStudentService.update.mockResolvedValue({
        hasCompletedInitialEnrollment: true,
      });

      await service.approve('request-1', 'employee-1', {
        institution: 'IF',
        busRouteId: 'route-1',
      });

      expect(mockBusRouteService.findOneOrFail).toHaveBeenCalledWith('route-1');
      expect(mockBusService.findByIdentifier).toHaveBeenCalledWith('A01');
      expect(mockLicenseService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bus: 'A01',
        }),
        'employee-1',
        6,
        'period-1',
        true,
        undefined,
        expect.objectContaining({
          accessBusIdentifiers: ['A01'],
        }),
      );
    });

    it('deve manter aprovacao mesmo se email de update falhar', async () => {
      mockRepository.findById.mockResolvedValue(
        makeRequest({
          type: LicenseRequestType.UPDATE,
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
        makeRequest({ status: LicenseRequestStatus.APPROVED, type: LicenseRequestType.UPDATE }),
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
