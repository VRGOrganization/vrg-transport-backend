import { } from '@nestjs/common';

describe('BusService (queue counts)', () => {
  let BusServiceCtor: any;

  const mockRepository: any = {
    findAllActive: jest.fn(),
    findById: jest.fn(),
  };

  const mockUniversityService = {};
  const mockAuditLog = { record: jest.fn() };

  const mockLicenseRequestRepository: any = {
    findAll: jest.fn(),
  };

  const mockStudentService = {};
  const mockMailService = {};
  const mockEnrollmentPeriodService: any = { getActive: jest.fn() };
  const mockLicenseService = {};

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

  it('agrega contagens por ônibus e universidade para o período ativo', async () => {
    const service = buildService();

    const buses = [
      {
        _id: 'bus-1',
        identifier: 'Bus 1',
        capacity: 10,
        universitySlots: [
          { universityId: { toString: () => 'uni-1' }, priorityOrder: 1, filledSlots: 2 },
          { universityId: { toString: () => 'uni-2' }, priorityOrder: 2, filledSlots: 1 },
        ],
      },
      {
        _id: 'bus-2',
        identifier: 'Bus 2',
        capacity: 5,
        universitySlots: [],
      },
    ];

    mockRepository.findAllActive.mockResolvedValue(buses);
    mockEnrollmentPeriodService.getActive.mockResolvedValue({ _id: 'period-1' });

    const requests = [
      { _id: 'r1', status: 'pending', busId: 'bus-1', universityId: 'uni-1', enrollmentPeriodId: 'period-1', createdAt: new Date('2026-01-01') },
      { _id: 'r2', status: 'pending', busId: 'bus-1', universityId: 'uni-2', enrollmentPeriodId: 'period-1', createdAt: new Date('2026-01-02') },
      { _id: 'r3', status: 'waitlisted', busId: 'bus-1', universityId: 'uni-2', enrollmentPeriodId: 'period-1', createdAt: new Date('2026-01-03') },
      { _id: 'r4', status: 'pending', busId: 'bus-2', universityId: 'uni-3', enrollmentPeriodId: 'period-1', createdAt: new Date('2026-01-04') },
      { _id: 'r5', status: 'pending', busId: 'bus-1', universityId: 'uni-1', enrollmentPeriodId: 'period-2' },
    ];

    mockLicenseRequestRepository.findAll.mockResolvedValue(requests);

    const result = await service.getQueueCounts();

    expect(Array.isArray(result)).toBe(true);
    const bus1 = result.find((b: any) => b._id === 'bus-1');
    expect(bus1.pendingCount).toBe(2);
    expect(bus1.waitlistedCount).toBe(1);

    const uni1Slot = bus1.universitySlots.find((s: any) => s.universityId === 'uni-1');
    expect(uni1Slot.pendingCount).toBe(1);
    expect(uni1Slot.waitlistedCount).toBe(0);

    const uni2Slot = bus1.universitySlots.find((s: any) => s.universityId === 'uni-2');
    expect(uni2Slot.pendingCount).toBe(1);
    expect(uni2Slot.waitlistedCount).toBe(1);
  });

  it('retorna resumo com listas de pending e waitlisted para um ônibus', async () => {
    const service = buildService();

    mockRepository.findById = jest.fn().mockResolvedValue({
      _id: 'bus-1',
      identifier: 'Bus 1',
      capacity: 10,
      universitySlots: [
        { universityId: { toString: () => 'uni-1' }, priorityOrder: 1, filledSlots: 2 },
      ],
    });

    mockEnrollmentPeriodService.getActive.mockResolvedValue({ _id: 'period-1' });

    const requests = [
      { _id: 'r1', status: 'pending', busId: 'bus-1', universityId: 'uni-1', enrollmentPeriodId: 'period-1', createdAt: new Date('2026-01-01') },
      { _id: 'r2', status: 'waitlisted', busId: 'bus-1', universityId: 'uni-1', enrollmentPeriodId: 'period-1', createdAt: new Date('2026-01-02') },
    ];

    mockLicenseRequestRepository.findAll.mockResolvedValue(requests);

    const summary = await service.getQueueSummary('bus-1');

    expect(summary._id).toBe('bus-1');
    expect(Array.isArray(summary.pendingRequests)).toBe(true);
    expect(Array.isArray(summary.waitlistedRequests)).toBe(true);
    expect(summary.pendingRequests.length).toBe(1);
    expect(summary.waitlistedRequests.length).toBe(1);
  });
});
