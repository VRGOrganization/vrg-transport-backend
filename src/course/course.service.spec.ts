import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CourseService } from './course.service';
import { COURSE_REPOSITORY } from './interface/repository.interface';
import { AuditLogService } from '../common/audit/audit-log.service';
import { UniversityService } from '../university/university.service';

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAllInactive: jest.fn(),
  findById: jest.fn(),
  findByUniversity: jest.fn(),
  findByNameAndUniversity: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
};

const mockUniversityService = {
  assertActive: jest.fn(),
  findOneOrFail: jest.fn(),
};

const mockAuditLog = {
  record: jest.fn(),
};

describe('CourseService', () => {
  let service: CourseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseService,
        { provide: COURSE_REPOSITORY, useValue: mockRepository },
        { provide: UniversityService, useValue: mockUniversityService },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get(CourseService);
    jest.clearAllMocks();
  });

  it('bloqueia curso em faculdade inativa', async () => {
    mockUniversityService.assertActive.mockRejectedValue(
      new ConflictException('Não é possível usar uma faculdade inativa.'),
    );

    await expect(
      service.create(
        { name: 'Psicologia', universityId: 'u-1' } as any,
        'admin-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('valida faculdade ativa antes de listar cursos da faculdade', async () => {
    mockUniversityService.assertActive.mockResolvedValue({
      _id: 'u-1',
      active: true,
    });
    mockRepository.findByUniversity.mockResolvedValue([]);

    await service.findByUniversity('u-1');

    expect(mockUniversityService.assertActive).toHaveBeenCalledWith('u-1');
  });
});
