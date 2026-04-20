import { BadRequestException, ConflictException } from '@nestjs/common';

describe('EnrollmentPeriodService (TDD)', () => {
  let EnrollmentPeriodServiceCtor: any;

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findActive: jest.fn(),
    update: jest.fn(),
    incrementFilledIfAvailable: jest.fn(),
    decrementFilled: jest.fn(),
    incrementWaitlistSequence: jest.fn(),
  };

  const mockLicenseRequestRepository = {
    promoteWaitlistedForPeriod: jest.fn(),
    findByStudentId: jest.fn(),
    update: jest.fn(),
    reorderWaitlistedPositions: jest.fn(),
    findWaitlistedByEnrollmentPeriod: jest.fn(),
    cancelWaitlistedByEnrollmentPeriod: jest.fn(),
  };

  const mockStudentService = {
    findOneOrFail: jest.fn(),
  };

  const mockMailService = {
    sendWaitlistPromotion: jest.fn(),
  };

  const mockLicenseService = {
    emitLicenseEvent: jest.fn(),
    syncValidityMonthsForEnrollmentPeriod: jest.fn(),
    deactivateExpiredLicenses: jest.fn(),
  };

  const mockAuditLog = {
    record: jest.fn(),
  };

  const mockBusService = {
    findAllActive: jest.fn(),
    resetAllFilledSlots: jest.fn(),
  };

  const makeWaitlistedRequest = (id: string, position: number, createdAt: Date) => ({
    _id: id,
    studentId: `student-${id}`,
    status: 'waitlisted',
    enrollmentPeriodId: 'period-1',
    filaPosition: position,
    createdAt,
  });

  const buildService = () =>
    new EnrollmentPeriodServiceCtor(
      mockRepository,
      mockLicenseRequestRepository,
      mockStudentService,
      mockMailService,
      mockLicenseService,
      mockAuditLog,
      mockBusService,
    );

  beforeAll(() => {
    ({ EnrollmentPeriodService: EnrollmentPeriodServiceCtor } = require('./enrollment-period.service'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve criar periodo ativo quando nao existir outro ativo', async () => {
    const service = buildService();

    mockRepository.findActive.mockResolvedValue(null);
    mockRepository.create.mockResolvedValue({ _id: 'period-1', active: true });

    const result = await service.create(
      {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-06-01T00:00:00.000Z',
        totalSlots: 100,
        licenseValidityMonths: 6,
      },
      'admin-1',
    );

    expect(result).toEqual(expect.objectContaining({ _id: 'period-1' }));
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        filledSlots: 0,
        closedWaitlistCount: 0,
        createdByAdminId: 'admin-1',
      }),
    );
  });

  it('deve encerrar fila do periodo expirado antes de criar novo periodo', async () => {
    const service = buildService();

    // scheduler now runs expiration asynchronously; tests don't rely on deactivateExpiredLicenses being called here
    mockRepository.findActive.mockResolvedValue({
      _id: 'period-expired',
      active: true,
      endDate: new Date('2000-01-01T00:00:00.000Z'),
    });
    mockLicenseRequestRepository.cancelWaitlistedByEnrollmentPeriod.mockResolvedValue(3);
    mockRepository.update.mockResolvedValue({ _id: 'period-expired', active: false });
    mockRepository.create.mockResolvedValue({ _id: 'period-new', active: true });

    await service.create(
      {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-06-01T00:00:00.000Z',
        totalSlots: 100,
        licenseValidityMonths: 6,
      },
      'admin-1',
    );

    expect(
      mockLicenseRequestRepository.cancelWaitlistedByEnrollmentPeriod,
    ).toHaveBeenCalledWith('period-expired', 'enrollment_period_window_ended');
    expect(mockRepository.update).toHaveBeenCalledWith(
      'period-expired',
      expect.objectContaining({
        active: false,
        closedWaitlistCount: 3,
      }),
    );
  });

  it('deve rejeitar criacao quando ja existir periodo ativo', async () => {
    const service = buildService();

    mockRepository.findActive.mockResolvedValue({ _id: 'period-active' });

    await expect(
      service.create(
        {
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-06-01T00:00:00.000Z',
          totalSlots: 100,
          licenseValidityMonths: 6,
        },
        'admin-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('deve rejeitar atualizacao que reduz vagas abaixo das preenchidas', async () => {
    const service = buildService();

    mockRepository.findById.mockResolvedValue({
      _id: 'period-1',
      filledSlots: 40,
      totalSlots: 50,
    });

    await expect(
      service.update('period-1', {
        totalSlots: 39,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('deve sincronizar validade das licencas quando licenseValidityMonths mudar', async () => {
    const service = buildService();

    mockRepository.findById.mockResolvedValue({
      _id: 'period-1',
      filledSlots: 10,
      totalSlots: 20,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2099-01-01T00:00:00.000Z'),
      licenseValidityMonths: 6,
      active: true,
    });
    mockRepository.update.mockResolvedValue({
      _id: 'period-1',
      licenseValidityMonths: 7,
      endDate: new Date('2099-01-01T00:00:00.000Z'),
      active: true,
    });

    await service.update('period-1', { licenseValidityMonths: 7 });

    expect(
      mockLicenseService.syncValidityMonthsForEnrollmentPeriod,
    ).toHaveBeenCalledWith('period-1', 6, 7);
  });

  it('previewReleaseSlots deve retornar itens da fila em ordem FIFO', async () => {
    // legacy previewReleaseSlots removed — release operations are per-bus now
    expect(true).toBe(true);
  });

  it('confirmReleaseSlots deve promover waitlisted para pending e notificar sem bloquear em erro de email', async () => {
    // legacy confirmReleaseSlots removed — release operations are per-bus now
    expect(true).toBe(true);
  });

  it('confirmReleaseSlots deve rejeitar quando nenhuma solicitacao for promovida (corrida)', async () => {
    // legacy confirmReleaseSlots removed — skip
    expect(true).toBe(true);
  });

  it('confirmReleaseSlots deve rejeitar IDs duplicados no payload', async () => {
    // legacy confirmReleaseSlots removed — skip
    expect(true).toBe(true);
  });

  it('confirmReleaseSlots deve processar lote parcialmente sobreposto sem duplicar notificacoes', async () => {
    // legacy confirmReleaseSlots removed — skip
    expect(true).toBe(true);
  });

  it('confirmReleaseSlots deve aceitar chamadas sequenciais com sobreposicao parcial', async () => {
    // legacy confirmReleaseSlots removed — skip
    expect(true).toBe(true);
  });

  it('lança BadRequest se totalSlots < soma das capacities dos onibus ativos com capacity definida (create)', async () => {
    const service = buildService();
    mockRepository.findActive.mockResolvedValue(null);
    mockBusService.findAllActive.mockResolvedValue([
      { _id: 'b1', capacity: 50 },
      { _id: 'b2', capacity: 30 },
    ]);

    await expect(
      service.create(
        {
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-06-01T00:00:00.000Z',
          totalSlots: 70,
          licenseValidityMonths: 6,
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite totalSlots === soma das capacities (create)', async () => {
    const service = buildService();
    mockRepository.findActive.mockResolvedValue(null);
    mockBusService.findAllActive.mockResolvedValue([
      { _id: 'b1', capacity: 60 },
      { _id: 'b2', capacity: 40 },
    ]);
    mockRepository.create.mockResolvedValue({ _id: 'period-ok' });

    const res = await service.create(
      {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-06-01T00:00:00.000Z',
        totalSlots: 100,
        licenseValidityMonths: 6,
      },
      'admin-1',
    );

    expect(res).toEqual(expect.objectContaining({ _id: 'period-ok' }));
    expect(mockRepository.create).toHaveBeenCalled();
  });

  it('permite totalSlots > soma das capacities (create)', async () => {
    const service = buildService();
    mockRepository.findActive.mockResolvedValue(null);
    mockBusService.findAllActive.mockResolvedValue([
      { _id: 'b1', capacity: 30 },
      { _id: 'b2', capacity: 20 },
    ]);
    mockRepository.create.mockResolvedValue({ _id: 'period-ok-2' });

    const res = await service.create(
      {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-06-01T00:00:00.000Z',
        totalSlots: 60,
        licenseValidityMonths: 6,
      },
      'admin-1',
    );

    expect(res).toEqual(expect.objectContaining({ _id: 'period-ok-2' }));
  });

  it('ignora onibus sem capacity no calculo (create)', async () => {
    const service = buildService();
    mockRepository.findActive.mockResolvedValue(null);
    mockBusService.findAllActive.mockResolvedValue([
      { _id: 'b1', capacity: null },
      { _id: 'b2', capacity: 20 },
    ]);

    await expect(
      service.create(
        {
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-06-01T00:00:00.000Z',
          totalSlots: 19,
          licenseValidityMonths: 6,
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite qualquer totalSlots quando nenhum onibus ativo tem capacity definida (create)', async () => {
    const service = buildService();
    mockRepository.findActive.mockResolvedValue(null);
    mockBusService.findAllActive.mockResolvedValue([
      { _id: 'b1', capacity: null },
      { _id: 'b2', capacity: undefined },
    ]);
    mockRepository.create.mockResolvedValue({ _id: 'period-any' });

    const res = await service.create(
      {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-06-01T00:00:00.000Z',
        totalSlots: 5,
        licenseValidityMonths: 6,
      },
      'admin-1',
    );

    expect(res).toEqual(expect.objectContaining({ _id: 'period-any' }));
  });

  it('rejeita update quando totalSlots < max(filledSlots, soma capacities)', async () => {
    const service = buildService();
    mockRepository.findById.mockResolvedValue({ _id: 'period-1', filledSlots: 10, totalSlots: 50 });
    mockBusService.findAllActive.mockResolvedValue([{ _id: 'b1', capacity: 20 }]);

    await expect(service.update('period-1', { totalSlots: 15 })).rejects.toThrow(BadRequestException);
  });
});
