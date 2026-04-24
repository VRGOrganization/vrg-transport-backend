import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../common/audit/audit-log.service';
import { BUS_ROUTE_REPOSITORY } from './interface/repository.interface';
import { BusRouteService } from './bus-route.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAllInactive: jest.fn(),
  findById: jest.fn(),
  findByLineNumberNormalized: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
};

const mockAuditLog = {
  record: jest.fn(),
};

describe('BusRouteService', () => {
  let service: BusRouteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusRouteService,
        { provide: BUS_ROUTE_REPOSITORY, useValue: mockRepository },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get(BusRouteService);
    jest.clearAllMocks();
  });

  it('cria rota com destinos normalizados', async () => {
    mockRepository.findByLineNumberNormalized.mockResolvedValue(null);
    mockRepository.create.mockResolvedValue({
      _id: 'route-1',
      lineNumber: '02',
    });

    await service.create(
      {
        lineNumber: '02',
        destinations: [{ name: 'Hospital Central' }, { name: 'IFF' }],
      } as any,
      'admin-1',
    );

    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lineNumberNormalized: '02',
        destinations: [
          expect.objectContaining({ nameNormalized: 'hospital central', active: true }),
          expect.objectContaining({ nameNormalized: 'iff', active: true }),
        ],
      }),
    );
  });

  it('bloqueia rota duplicada por numero ativo', async () => {
    mockRepository.findByLineNumberNormalized.mockResolvedValue({ _id: 'route-1' });

    await expect(
      service.create(
        {
          lineNumber: '02',
          destinations: [{ name: 'IFF' }],
        } as any,
        'admin-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('nao permite rota sem destino ativo', async () => {
    mockRepository.findByLineNumberNormalized.mockResolvedValue(null);

    await expect(
      service.create(
        {
          lineNumber: '02',
          destinations: [{ name: 'IFF', active: false }],
        } as any,
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('remove destino mantendo pelo menos um ativo', async () => {
    mockRepository.findById.mockResolvedValue({
      _id: 'route-1',
      active: true,
      destinations: [
        { name: 'IFF', nameNormalized: 'iff', active: true },
        { name: 'Hospital', nameNormalized: 'hospital', active: true },
      ],
    });
    mockRepository.update.mockResolvedValue({
      _id: 'route-1',
      destinations: [
        { name: 'IFF', nameNormalized: 'iff', active: false },
        { name: 'Hospital', nameNormalized: 'hospital', active: true },
      ],
    });

    await service.removeDestination('route-1', 'IFF', 'admin-1');

    expect(mockRepository.update).toHaveBeenCalledWith(
      'route-1',
      expect.objectContaining({
        destinations: [
          expect.objectContaining({ active: false }),
          expect.objectContaining({ active: true }),
        ],
      }),
    );
  });

  it('nao remove o ultimo destino ativo', async () => {
    mockRepository.findById.mockResolvedValue({
      _id: 'route-1',
      active: true,
      destinations: [
        { name: 'IFF', nameNormalized: 'iff', active: true },
      ],
    });

    await expect(
      service.removeDestination('route-1', 'IFF', 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lança NotFoundException quando rota nao existe', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(service.findOneOrFail('route-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
