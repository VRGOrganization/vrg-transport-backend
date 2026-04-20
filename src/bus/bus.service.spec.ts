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
});
