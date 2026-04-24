import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UniversityService } from './university.service';
import { UNIVERSITY_REPOSITORY } from './interface/repository.interface';
import { AuditLogService } from '../common/audit/audit-log.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAllInactive: jest.fn(),
  findById: jest.fn(),
  findByAcronym: jest.fn(),
  findByNameNormalized: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
};

const mockAuditLog = {
  record: jest.fn(),
};

describe('UniversityService', () => {
  let service: UniversityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UniversityService,
        { provide: UNIVERSITY_REPOSITORY, useValue: mockRepository },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get(UniversityService);
    jest.clearAllMocks();
  });

  it('bloqueia faculdade duplicada por nome normalizado', async () => {
    mockRepository.findByAcronym.mockResolvedValue(null);
    mockRepository.findByNameNormalized.mockResolvedValue({ _id: 'u-1' });

    await expect(
      service.create(
        { name: 'Universidade Federal', acronym: 'UFF', address: 'Rua X' } as any,
        'admin-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('marca nome normalizado na criacao', async () => {
    mockRepository.findByAcronym.mockResolvedValue(null);
    mockRepository.findByNameNormalized.mockResolvedValue(null);
    mockRepository.create.mockResolvedValue({
      _id: 'u-1',
      name: 'Universidade Federal',
      acronym: 'UFF',
      address: 'Rua X',
    });

    await service.create(
      { name: 'Universidade Federal', acronym: 'UFF', address: 'Rua X' } as any,
      'admin-1',
    );

    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nameNormalized: 'universidade federal',
      }),
    );
  });

  it('lança erro quando universidade não existe', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(service.findOneOrFail('u-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
