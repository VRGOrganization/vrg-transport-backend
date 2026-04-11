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
    mockRepository.create.mockResolvedValue({ _id: 'period-1', ativo: true });
    mockLicenseService.deactivateExpiredLicenses.mockResolvedValue(0);

    const result = await service.create(
      {
        dataInicio: '2026-01-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
        qtdVagasTotais: 100,
        validadeCarteirinhaMeses: 6,
      },
      'admin-1',
    );

    expect(result).toEqual(expect.objectContaining({ _id: 'period-1' }));
    expect(mockLicenseService.deactivateExpiredLicenses).toHaveBeenCalled();
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ativo: true,
        qtdVagasPreenchidas: 0,
        qtdFilaEncerrada: 0,
        criadoPorAdminId: 'admin-1',
      }),
    );
  });

  it('deve encerrar fila do periodo expirado antes de criar novo periodo', async () => {
    const service = buildService();

    mockLicenseService.deactivateExpiredLicenses.mockResolvedValue(1);
    mockRepository.findActive.mockResolvedValue({
      _id: 'period-expired',
      ativo: true,
      dataFim: new Date('2000-01-01T00:00:00.000Z'),
    });
    mockLicenseRequestRepository.cancelWaitlistedByEnrollmentPeriod.mockResolvedValue(3);
    mockRepository.update.mockResolvedValue({ _id: 'period-expired', ativo: false });
    mockRepository.create.mockResolvedValue({ _id: 'period-new', ativo: true });

    await service.create(
      {
        dataInicio: '2026-01-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
        qtdVagasTotais: 100,
        validadeCarteirinhaMeses: 6,
      },
      'admin-1',
    );

    expect(
      mockLicenseRequestRepository.cancelWaitlistedByEnrollmentPeriod,
    ).toHaveBeenCalledWith('period-expired', 'enrollment_period_window_ended');
    expect(mockRepository.update).toHaveBeenCalledWith(
      'period-expired',
      expect.objectContaining({
        ativo: false,
        qtdFilaEncerrada: 3,
      }),
    );
  });

  it('deve rejeitar criacao quando ja existir periodo ativo', async () => {
    const service = buildService();

    mockRepository.findActive.mockResolvedValue({ _id: 'period-active' });

    await expect(
      service.create(
        {
          dataInicio: '2026-01-01T00:00:00.000Z',
          dataFim: '2026-06-01T00:00:00.000Z',
          qtdVagasTotais: 100,
          validadeCarteirinhaMeses: 6,
        },
        'admin-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('deve rejeitar atualizacao que reduz vagas abaixo das preenchidas', async () => {
    const service = buildService();

    mockRepository.findById.mockResolvedValue({
      _id: 'period-1',
      qtdVagasPreenchidas: 40,
      qtdVagasTotais: 50,
    });

    await expect(
      service.update('period-1', {
        qtdVagasTotais: 39,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('deve sincronizar validade das licencas quando validadeCarteirinhaMeses mudar', async () => {
    const service = buildService();

    mockRepository.findById.mockResolvedValue({
      _id: 'period-1',
      qtdVagasPreenchidas: 10,
      qtdVagasTotais: 20,
      dataInicio: new Date('2026-01-01T00:00:00.000Z'),
      dataFim: new Date('2099-01-01T00:00:00.000Z'),
      validadeCarteirinhaMeses: 6,
      ativo: true,
    });
    mockRepository.update.mockResolvedValue({
      _id: 'period-1',
      validadeCarteirinhaMeses: 7,
      dataFim: new Date('2099-01-01T00:00:00.000Z'),
      ativo: true,
    });

    await service.update('period-1', { validadeCarteirinhaMeses: 7 });

    expect(
      mockLicenseService.syncValidityMonthsForEnrollmentPeriod,
    ).toHaveBeenCalledWith('period-1', 6, 7);
  });

  it('previewReleaseSlots deve retornar itens da fila em ordem FIFO', async () => {
    const service = buildService();

    const list = [
      makeWaitlistedRequest('3', 3, new Date('2026-01-03T00:00:00.000Z')),
      makeWaitlistedRequest('1', 1, new Date('2026-01-01T00:00:00.000Z')),
      makeWaitlistedRequest('2', 2, new Date('2026-01-02T00:00:00.000Z')),
    ];

    mockRepository.findById.mockResolvedValue({ _id: 'period-1' });
    mockLicenseRequestRepository.findWaitlistedByEnrollmentPeriod.mockResolvedValue(list);

    const result = await service.previewReleaseSlots('period-1', 2);

    expect(result).toHaveLength(2);
    expect(result[0]._id).toBe('1');
    expect(result[1]._id).toBe('2');
  });

  it('confirmReleaseSlots deve promover waitlisted para pending e notificar sem bloquear em erro de email', async () => {
    const service = buildService();

    const requestA = makeWaitlistedRequest('r1', 1, new Date('2026-01-01T00:00:00.000Z'));
    const requestB = makeWaitlistedRequest('r2', 2, new Date('2026-01-02T00:00:00.000Z'));
    const requestC = makeWaitlistedRequest('r3', 3, new Date('2026-01-03T00:00:00.000Z'));

    mockRepository.findById.mockResolvedValue({ _id: 'period-1' });
    mockLicenseRequestRepository.promoteWaitlistedForPeriod
      .mockResolvedValueOnce(requestA)
      .mockResolvedValueOnce(requestB);
    mockStudentService.findOneOrFail
      .mockResolvedValueOnce({ email: 'a@mail.com', name: 'A' })
      .mockResolvedValueOnce({ email: 'b@mail.com', name: 'B' });
    mockMailService.sendWaitlistPromotion
      .mockRejectedValueOnce(new Error('mail down'))
      .mockResolvedValueOnce(undefined);
    mockLicenseRequestRepository.findWaitlistedByEnrollmentPeriod.mockResolvedValue([requestC]);

    await service.confirmReleaseSlots('period-1', ['r1', 'r2']);

    expect(
      mockLicenseRequestRepository.promoteWaitlistedForPeriod,
    ).toHaveBeenNthCalledWith(1, 'r1', 'period-1');
    expect(
      mockLicenseRequestRepository.promoteWaitlistedForPeriod,
    ).toHaveBeenNthCalledWith(2, 'r2', 'period-1');
    expect(mockLicenseRequestRepository.update).toHaveBeenCalledWith(
      'r3',
      expect.objectContaining({ filaPosition: 1 }),
    );
    expect(mockLicenseService.emitLicenseEvent).toHaveBeenCalledWith('student-r1', {
      type: 'license.changed',
      reason: 'waitlist_promoted',
    });
    expect(mockLicenseService.emitLicenseEvent).toHaveBeenCalledWith('student-r2', {
      type: 'license.changed',
      reason: 'waitlist_promoted',
    });
    expect(mockAuditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'enrollment_period.release_slots' }),
    );
  });

  it('confirmReleaseSlots deve rejeitar quando nenhuma solicitacao for promovida (corrida)', async () => {
    const service = buildService();

    mockRepository.findById.mockResolvedValue({ _id: 'period-1' });
    mockLicenseRequestRepository.promoteWaitlistedForPeriod.mockResolvedValue(null);

    await expect(service.confirmReleaseSlots('period-1', ['x1'])).rejects.toThrow(
      ConflictException,
    );
  });

  it('confirmReleaseSlots deve rejeitar IDs duplicados no payload', async () => {
    const service = buildService();

    mockRepository.findById.mockResolvedValue({ _id: 'period-1' });

    await expect(service.confirmReleaseSlots('period-1', ['r1', 'r1'])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('confirmReleaseSlots deve processar lote parcialmente sobreposto sem duplicar notificacoes', async () => {
    const service = buildService();

    const requestA = makeWaitlistedRequest('r1', 1, new Date('2026-01-01T00:00:00.000Z'));
    const requestC = makeWaitlistedRequest('r3', 3, new Date('2026-01-03T00:00:00.000Z'));
    const remaining = makeWaitlistedRequest('r4', 4, new Date('2026-01-04T00:00:00.000Z'));

    mockRepository.findById.mockResolvedValue({ _id: 'period-1' });
    mockLicenseRequestRepository.promoteWaitlistedForPeriod
      .mockResolvedValueOnce(requestA)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(requestC);
    mockStudentService.findOneOrFail
      .mockResolvedValueOnce({ email: 'a@mail.com', name: 'A' })
      .mockResolvedValueOnce({ email: 'c@mail.com', name: 'C' });
    mockMailService.sendWaitlistPromotion.mockResolvedValue(undefined);
    mockLicenseRequestRepository.findWaitlistedByEnrollmentPeriod.mockResolvedValue([
      remaining,
    ]);

    await service.confirmReleaseSlots('period-1', ['r1', 'r2', 'r3']);

    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenCalledTimes(3);
    expect(mockLicenseService.emitLicenseEvent).toHaveBeenCalledTimes(2);
    expect(mockLicenseService.emitLicenseEvent).toHaveBeenCalledWith('student-r1', {
      type: 'license.changed',
      reason: 'waitlist_promoted',
    });
    expect(mockLicenseService.emitLicenseEvent).toHaveBeenCalledWith('student-r3', {
      type: 'license.changed',
      reason: 'waitlist_promoted',
    });
    expect(mockMailService.sendWaitlistPromotion).toHaveBeenCalledTimes(2);
    expect(mockLicenseRequestRepository.update).toHaveBeenCalledWith(
      'r4',
      expect.objectContaining({ filaPosition: 1 }),
    );
    expect(mockAuditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'enrollment_period.release_slots',
        metadata: expect.objectContaining({
          requestedRequestIds: ['r1', 'r2', 'r3'],
          releasedRequestIds: ['r1', 'r3'],
          skippedRequestIds: ['r2'],
        }),
      }),
    );
  });

  it('confirmReleaseSlots deve aceitar chamadas sequenciais com sobreposicao parcial', async () => {
    const service = buildService();

    const request1 = makeWaitlistedRequest('r1', 1, new Date('2026-01-01T00:00:00.000Z'));
    const request2 = makeWaitlistedRequest('r2', 2, new Date('2026-01-02T00:00:00.000Z'));
    const request3 = makeWaitlistedRequest('r3', 3, new Date('2026-01-03T00:00:00.000Z'));

    mockRepository.findById.mockResolvedValue({ _id: 'period-1' });
    mockStudentService.findOneOrFail.mockResolvedValue({ email: 'ok@mail.com', name: 'Aluno' });
    mockMailService.sendWaitlistPromotion.mockResolvedValue(undefined);

    mockLicenseRequestRepository.promoteWaitlistedForPeriod
      .mockResolvedValueOnce(request1)
      .mockResolvedValueOnce(request2)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(request3);

    mockLicenseRequestRepository.findWaitlistedByEnrollmentPeriod
      .mockResolvedValueOnce([request3])
      .mockResolvedValueOnce([]);

    await service.confirmReleaseSlots('period-1', ['r1', 'r2']);
    await service.confirmReleaseSlots('period-1', ['r2', 'r3']);

    expect(mockLicenseService.emitLicenseEvent).toHaveBeenCalledTimes(3);
    expect(mockAuditLog.record).toHaveBeenCalledTimes(2);
    expect(mockAuditLog.record).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          requestedRequestIds: ['r2', 'r3'],
          releasedRequestIds: ['r3'],
          skippedRequestIds: ['r2'],
        }),
      }),
    );
  });
});
