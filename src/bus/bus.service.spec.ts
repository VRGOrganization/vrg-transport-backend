describe('BusService (promotion)', () => {
  let BusServiceCtor: any;

  const mockRepository = {
    findById: jest.fn(),
    resetUniversityFilledSlots: jest.fn(),
    findAll: jest.fn(),
    findAllActive: jest.fn(),
    update: jest.fn(),
    reorderWaitlistedPositions: jest.fn(),
    findByUniversityId: jest.fn(),
    incrementUniversityFilledSlots: jest.fn(),
    decrementUniversityFilledSlots: jest.fn(),
    deactivate: jest.fn(),
  };

  const mockUniversityService = {};
  const mockAuditLog = { record: jest.fn() };

  const mockLicenseRequestRepository = {
    findWaitlistedByEnrollmentPeriod: jest.fn(),
    findWaitlistedByEnrollmentPeriodAndBus: jest.fn(),
    findByEnrollmentPeriodAndBusGrouped: jest.fn(),
    promoteWaitlistedForPeriod: jest.fn(),
    update: jest.fn(),
    reorderWaitlistedPositions: jest.fn(),
  };

  const mockStudentService = { findOneOrFail: jest.fn() };
  const mockMailService = { sendWaitlistPromotion: jest.fn() };
  const mockEnrollmentPeriodService = { getActive: jest.fn() };
  const mockLicenseService = { emitLicenseEvent: jest.fn() };

  const buildService = () =>
    new BusServiceCtor(
      mockRepository,
      mockUniversityService,
      mockAuditLog,
      mockLicenseRequestRepository,
      mockStudentService,
      mockMailService,
      mockEnrollmentPeriodService,
      mockLicenseService,
    );

  beforeAll(() => {
    ({ BusService: BusServiceCtor } = require('./bus.service'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve promover até releasedSlots por prioridade de universidade', async () => {
    const service = buildService();

    const busId = 'bus-1';
    const adminId = 'admin-1';

    mockRepository.findById.mockResolvedValue({
      _id: busId,
      universitySlots: [
        { universityId: { toString: () => 'uni-1' }, priorityOrder: 1 },
        { universityId: { toString: () => 'uni-2' }, priorityOrder: 2 },
      ],
    });

    mockRepository.resetUniversityFilledSlots.mockResolvedValue(2);
    mockEnrollmentPeriodService.getActive.mockResolvedValue({ _id: 'period-1' });

    // grouped counts per university for this bus
    mockLicenseRequestRepository.findByEnrollmentPeriodAndBusGrouped.mockResolvedValue([
      {
        _id: busId,
        perUniversity: [
          { universityId: 'uni-1', pending: 0, waitlisted: 2 },
          { universityId: 'uni-2', pending: 0, waitlisted: 1 },
        ],
        pending: 0,
        waitlisted: 3,
      },
    ]);

    const r1 = { _id: 'r1', studentId: 'student-r1', universityId: 'uni-1', busId: 'bus-1', filaPosition: 1, createdAt: new Date('2026-01-01T00:00:00.000Z') };
    const r2 = { _id: 'r2', studentId: 'student-r2', universityId: 'uni-2', busId: 'bus-1', filaPosition: 1, createdAt: new Date('2026-01-02T00:00:00.000Z') };
    const r3 = { _id: 'r3', studentId: 'student-r3', universityId: 'uni-1', busId: 'bus-1', filaPosition: 2, createdAt: new Date('2026-01-03T00:00:00.000Z') };

    mockLicenseRequestRepository.findWaitlistedByEnrollmentPeriodAndBus
      .mockResolvedValueOnce([r3, r1, r2])
      .mockResolvedValueOnce([r2]);
    mockLicenseRequestRepository.promoteWaitlistedForPeriod.mockResolvedValueOnce(r1).mockResolvedValueOnce(r3);

    mockStudentService.findOneOrFail
      .mockResolvedValueOnce({ email: 'a@mail.com', name: 'A' })
      .mockResolvedValueOnce({ email: 'c@mail.com', name: 'C' });
    mockMailService.sendWaitlistPromotion.mockResolvedValue(undefined);

    const result = await service.releaseSlotsForBus(busId, adminId);

    expect(mockRepository.resetUniversityFilledSlots).toHaveBeenCalledWith(busId, undefined);
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenNthCalledWith(1, 'r1', 'period-1');
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenNthCalledWith(2, 'r3', 'period-1');
    expect(mockMailService.sendWaitlistPromotion).toHaveBeenCalledTimes(2);
    expect(mockLicenseService.emitLicenseEvent).toHaveBeenCalledWith('student-r1', {
      type: 'license.changed',
      reason: 'waitlist_promoted',
    });
    expect(mockLicenseService.emitLicenseEvent).toHaveBeenCalledWith('student-r3', {
      type: 'license.changed',
      reason: 'waitlist_promoted',
    });
    expect(mockLicenseRequestRepository.reorderWaitlistedPositions).toHaveBeenCalledWith(['r2']);
    expect(result).toEqual({ releasedSlots: 2 });
  });

  it('quando promote=false, não promove mesmo havendo vagas', async () => {
    const service = buildService();
    const busId = 'bus-1';
    const adminId = 'admin-1';

    mockRepository.findById.mockResolvedValue({ _id: busId, universitySlots: [] });
    mockRepository.resetUniversityFilledSlots.mockResolvedValue(2);
    mockEnrollmentPeriodService.getActive.mockResolvedValue({ _id: 'period-1' });
    mockLicenseRequestRepository.findWaitlistedByEnrollmentPeriod.mockResolvedValue([
      { _id: 'r1', busId: 'bus-1', studentId: 'student-r1', universityId: 'uni-1', filaPosition: 1, createdAt: new Date('2026-01-01T00:00:00.000Z') },
    ]);
    mockLicenseRequestRepository.findByEnrollmentPeriodAndBusGrouped.mockResolvedValue([
      { _id: busId, perUniversity: [{ universityId: 'uni-1', pending: 0, waitlisted: 1 }], pending: 0, waitlisted: 1 },
    ]);

    const result = await service.releaseSlotsForBus(busId, adminId, false);

    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).not.toHaveBeenCalled();
    expect(mockMailService.sendWaitlistPromotion).not.toHaveBeenCalled();
    expect(result).toEqual({ releasedSlots: 2 });
  });

  it('não promove prioridades inferiores se universidade superior tem pending (bloqueio)', async () => {
    const service = buildService();
    const busId = 'bus-1';
    const adminId = 'admin-1';

    mockRepository.findById.mockResolvedValue({
      _id: busId,
      universitySlots: [
        { universityId: { toString: () => 'uni-1' }, priorityOrder: 1 },
        { universityId: { toString: () => 'uni-2' }, priorityOrder: 2 },
      ],
    });

    mockRepository.resetUniversityFilledSlots.mockResolvedValue(2);
    mockEnrollmentPeriodService.getActive.mockResolvedValue({ _id: 'period-1' });

    // grouped: uni-1 has pending but no waitlist; uni-2 has waitlist
    mockLicenseRequestRepository.findByEnrollmentPeriodAndBusGrouped.mockResolvedValue([
      {
        _id: busId,
        perUniversity: [
          { universityId: 'uni-1', pending: 1, waitlisted: 0 },
          { universityId: 'uni-2', pending: 0, waitlisted: 3 },
        ],
        pending: 1,
        waitlisted: 3,
      },
    ]);

    // Even though uni-2 has waitlist, uni-1 pending should block promotions to uni-2
    mockLicenseRequestRepository.findWaitlistedByEnrollmentPeriodAndBus.mockResolvedValue([]);

    const result = await service.releaseSlotsForBus(busId, adminId, true);

    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).not.toHaveBeenCalled();
    expect(result).toEqual({ releasedSlots: 2 });
  });

  it('promove todos de P1 e passa para P2 somente quando P1 é totalmente esgotada', async () => {
    const service = buildService();
    const busId = 'bus-2';
    const adminId = 'admin-2';

    mockRepository.findById.mockResolvedValue({
      _id: busId,
      universitySlots: [
        { universityId: { toString: () => 'u1' }, priorityOrder: 1 },
        { universityId: { toString: () => 'u2' }, priorityOrder: 2 },
      ],
    });

    // release 3 slots
    mockRepository.resetUniversityFilledSlots.mockResolvedValue(3);
    mockEnrollmentPeriodService.getActive.mockResolvedValue({ _id: 'period-xyz' });

    mockLicenseRequestRepository.findByEnrollmentPeriodAndBusGrouped.mockResolvedValue([
      {
        _id: busId,
        perUniversity: [
          { universityId: 'u1', pending: 0, waitlisted: 2 },
          { universityId: 'u2', pending: 0, waitlisted: 3 },
        ],
        pending: 0,
        waitlisted: 5,
      },
    ]);

    const r1 = { _id: 'r1', studentId: 's1', universityId: 'u1', busId, filaPosition: 1, createdAt: new Date('2026-01-01') };
    const r2 = { _id: 'r2', studentId: 's2', universityId: 'u2', busId, filaPosition: 1, createdAt: new Date('2026-01-02') };
    const r3 = { _id: 'r3', studentId: 's3', universityId: 'u1', busId, filaPosition: 2, createdAt: new Date('2026-01-03') };
    const r4 = { _id: 'r4', studentId: 's4', universityId: 'u2', busId, filaPosition: 2, createdAt: new Date('2026-01-04') };
    const r5 = { _id: 'r5', studentId: 's5', universityId: 'u2', busId, filaPosition: 3, createdAt: new Date('2026-01-05') };

    // initial waitlist (unsorted intentionally)
    mockLicenseRequestRepository.findWaitlistedByEnrollmentPeriodAndBus
      .mockResolvedValueOnce([r4, r1, r2, r3, r5])
      .mockResolvedValueOnce([r4, r5]); // remaining after promotions

    mockLicenseRequestRepository.promoteWaitlistedForPeriod
      .mockResolvedValueOnce(r1)
      .mockResolvedValueOnce(r3)
      .mockResolvedValueOnce(r2);

    mockStudentService.findOneOrFail.mockResolvedValue({ email: 'x@mail', name: 'X' });
    mockMailService.sendWaitlistPromotion.mockResolvedValue(undefined);

    const result = await service.releaseSlotsForBus(busId, adminId);

    // expects to promote r1, r3 (u1 exhausted) then r2 from u2 (only 3 promoted)
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenCalledTimes(3);
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenNthCalledWith(1, 'r1', 'period-xyz');
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenNthCalledWith(2, 'r3', 'period-xyz');
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenNthCalledWith(3, 'r2', 'period-xyz');
    expect(mockLicenseRequestRepository.reorderWaitlistedPositions).toHaveBeenCalledWith(['r4', 'r5']);
    expect(result).toEqual({ releasedSlots: 3 });
  });

  it('promove P1 parcialmente e PARA sem passar para P2 mesmo com vagas sobrando', async () => {
    const service = buildService();
    const busId = 'bus-3';
    const adminId = 'admin-3';

    mockRepository.findById.mockResolvedValue({
      _id: busId,
      universitySlots: [
        { universityId: { toString: () => 'a1' }, priorityOrder: 1 },
        { universityId: { toString: () => 'a2' }, priorityOrder: 2 },
      ],
    });

    // release only 1 slot
    mockRepository.resetUniversityFilledSlots.mockResolvedValue(1);
    mockEnrollmentPeriodService.getActive.mockResolvedValue({ _id: 'period-abc' });

    mockLicenseRequestRepository.findByEnrollmentPeriodAndBusGrouped.mockResolvedValue([
      {
        _id: busId,
        perUniversity: [
          { universityId: 'a1', pending: 0, waitlisted: 2 },
          { universityId: 'a2', pending: 0, waitlisted: 3 },
        ],
        pending: 0,
        waitlisted: 5,
      },
    ]);

    const r1 = { _id: 'ra1', studentId: 'sa1', universityId: 'a1', busId, filaPosition: 1, createdAt: new Date('2026-02-01') };
    const r2 = { _id: 'ra2', studentId: 'sa2', universityId: 'a1', busId, filaPosition: 2, createdAt: new Date('2026-02-02') };
    const r3 = { _id: 'rb1', studentId: 'sb1', universityId: 'a2', busId, filaPosition: 1, createdAt: new Date('2026-02-03') };

    mockLicenseRequestRepository.findWaitlistedByEnrollmentPeriodAndBus
      .mockResolvedValueOnce([r2, r1, r3])
      .mockResolvedValueOnce([r2, r3]);

    mockLicenseRequestRepository.promoteWaitlistedForPeriod.mockResolvedValueOnce(r1);
    mockStudentService.findOneOrFail.mockResolvedValue({ email: 'y@mail', name: 'Y' });
    mockMailService.sendWaitlistPromotion.mockResolvedValue(undefined);

    const result = await service.releaseSlotsForBus(busId, adminId);

    // only one promotion (from a1) and no promotions from a2
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenCalledTimes(1);
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenCalledWith('ra1', 'period-abc');
    expect(result).toEqual({ releasedSlots: 1 });
  });

  it('libera exatamente N vagas quando quantity fornecido e não promove além disso', async () => {
    const service = buildService();
    const busId = 'bus-4';
    const adminId = 'admin-4';

    mockRepository.findById.mockResolvedValue({
      _id: busId,
      universitySlots: [
        { universityId: { toString: () => 'z1' }, priorityOrder: 1 },
      ],
    });

    // Caller requested to release quantity = 2
    mockRepository.resetUniversityFilledSlots.mockResolvedValue(2);
    mockEnrollmentPeriodService.getActive.mockResolvedValue({ _id: 'period-q' });

    mockLicenseRequestRepository.findByEnrollmentPeriodAndBusGrouped.mockResolvedValue([
      {
        _id: busId,
        perUniversity: [{ universityId: 'z1', pending: 0, waitlisted: 5 }],
        pending: 0,
        waitlisted: 5,
      },
    ]);

    const r1 = { _id: 'q1', studentId: 'q-s1', universityId: 'z1', busId, filaPosition: 1, createdAt: new Date('2026-03-01') };
    const r2 = { _id: 'q2', studentId: 'q-s2', universityId: 'z1', busId, filaPosition: 2, createdAt: new Date('2026-03-02') };
    const r3 = { _id: 'q3', studentId: 'q-s3', universityId: 'z1', busId, filaPosition: 3, createdAt: new Date('2026-03-03') };

    mockLicenseRequestRepository.findWaitlistedByEnrollmentPeriodAndBus
      .mockResolvedValueOnce([r1, r2, r3])
      .mockResolvedValueOnce([r3]);

    mockLicenseRequestRepository.promoteWaitlistedForPeriod
      .mockResolvedValueOnce(r1)
      .mockResolvedValueOnce(r2);

    const result = await service.releaseSlotsForBus(busId, adminId, true, 2);

    expect(mockRepository.resetUniversityFilledSlots).toHaveBeenCalledWith(busId, 2);
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenCalledTimes(2);
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenNthCalledWith(1, 'q1', 'period-q');
    expect(mockLicenseRequestRepository.promoteWaitlistedForPeriod).toHaveBeenNthCalledWith(2, 'q2', 'period-q');
    expect(result).toEqual({ releasedSlots: 2 });
  });
});
