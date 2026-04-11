import { Test, TestingModule } from '@nestjs/testing';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { STUDENT_REPOSITORY } from './interfaces/repository.interface';
import { AuditLogService } from '../common/audit/audit-log.service';
import { LicenseRequestService } from '../license-request/license-request.service';
import { ImagesService } from '../image/image.service';

const mockStudentRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findByEmailWithSensitiveFields: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockAuditLogService = {
  record: jest.fn(),
};

const mockLicenseRequestService = {
  assertInitialRequestEligibility: jest.fn(),
  createRequest: jest.fn(),
  cancelAndReplaceWithUpdate: jest.fn(),
  submitDocumentUpdateRequest: jest.fn(),
};

const mockImagesService = {
  // Add any methods if needed, but for now empty
};

describe('StudentController', () => {
  let controller: StudentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentController],
      providers: [
        StudentService,
        { provide: STUDENT_REPOSITORY, useValue: mockStudentRepository },
        { provide: AuditLogService, useValue: mockAuditLogService },
        {
          provide: LicenseRequestService,
          useValue: mockLicenseRequestService,
        },
        { provide: ImagesService, useValue: mockImagesService },
      ],
    }).compile();

    controller = module.get<StudentController>(StudentController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});