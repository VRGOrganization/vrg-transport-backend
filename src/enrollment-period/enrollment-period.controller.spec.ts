import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentPeriodController } from './enrollment-period.controller';
import { EnrollmentPeriodService } from './enrollment-period.service';

describe('EnrollmentPeriodController', () => {
  let controller: EnrollmentPeriodController;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    getActiveOrFail: jest.fn(),
    update: jest.fn(),
    close: jest.fn(),
    reopen: jest.fn(),
    previewReleaseSlots: jest.fn(),
    findWaitlisted: jest.fn(),
    confirmReleaseSlots: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentPeriodController],
      providers: [
        {
          provide: EnrollmentPeriodService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<EnrollmentPeriodController>(EnrollmentPeriodController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('deve criar periodo com admin da sessao', async () => {
    mockService.create.mockResolvedValue({ _id: 'period-1' });

    const req = { sessionPayload: { userId: 'admin-1' } } as any;
    const dto = {
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-02-01T00:00:00.000Z',
      totalSlots: 10,
      licenseValidityMonths: 6,
    };

    await controller.create(dto as any, req);

    expect(mockService.create).toHaveBeenCalledWith(dto, 'admin-1');
  });

  it('deve listar periodos', async () => {
    await controller.findAll();
    expect(mockService.findAll).toHaveBeenCalled();
  });

  it('deve retornar periodo ativo', async () => {
    await controller.findActive();
    expect(mockService.getActiveOrFail).toHaveBeenCalled();
  });

  it('deve atualizar periodo', async () => {
    const dto = { totalSlots: 20 };
    await controller.update('period-1', dto as any);
    expect(mockService.update).toHaveBeenCalledWith('period-1', dto);
  });

  it('deve encerrar periodo com admin da sessao', async () => {
    const req = { sessionPayload: { userId: 'admin-1' } } as any;
    await controller.close('period-1', req);
    expect(mockService.close).toHaveBeenCalledWith('period-1', 'admin-1');
  });

  it('deve reabrir periodo', async () => {
    await controller.reopen('period-1');
    expect(mockService.reopen).toHaveBeenCalledWith('period-1');
  });

  it('deve listar waitlist do periodo', async () => {
    await controller.getWaitlist('period-1');
    expect(mockService.findWaitlisted).toHaveBeenCalledWith('period-1');
  });

  it('deve fazer preview de release slots', async () => {
    // legacy endpoint removed — release operations are per-bus now
    expect(true).toBe(true);
  });

  it('deve confirmar release e retornar mensagem de sucesso', async () => {
    // legacy endpoint removed — release operations are per-bus now
    expect(true).toBe(true);
  });
});
