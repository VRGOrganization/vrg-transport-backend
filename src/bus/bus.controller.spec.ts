import { Test, TestingModule } from '@nestjs/testing';
import { BusController } from './bus.controller';
import { BusService } from './bus.service';
import { UniversityService } from '../university/university.service';

describe('BusController', () => {
  let controller: BusController;

  const mockService = {
    getQueueCounts: jest.fn(),
    getQueueSummary: jest.fn(),
  };
  const mockUniversityService = {
    findOneOrFail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusController],
      providers: [
        {
          provide: BusService,
          useValue: mockService,
        },
        {
          provide: UniversityService,
          useValue: mockUniversityService,
        },
      ],
    }).compile();

    controller = module.get<BusController>(BusController);
    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('deve chamar getQueueCounts', async () => {
    mockService.getQueueCounts.mockResolvedValue([]);
    await controller.getWithQueueCounts();
    expect(mockService.getQueueCounts).toHaveBeenCalled();
  });

  it('deve chamar getQueueSummary', async () => {
    mockService.getQueueSummary.mockResolvedValue({ _id: 'bus-1' });
    await controller.getQueueSummary('bus-1');
    expect(mockService.getQueueSummary).toHaveBeenCalledWith('bus-1');
  });
});
