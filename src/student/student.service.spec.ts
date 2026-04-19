import { Test, TestingModule } from '@nestjs/testing';
import { StudentService } from './student.service';
import { STUDENT_REPOSITORY } from './interfaces/repository.interface';
import { AuditLogService } from '../common/audit/audit-log.service';
import { ImagesService } from '../image/image.service';
import { BusService } from '../bus/bus.service';
 
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

const mockImagesService = {
  findByStudentId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockBusService = {
  findOneOrFail: jest.fn(),
};
 
describe('StudentService', () => {
  let service: StudentService;
 
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        { provide: STUDENT_REPOSITORY, useValue: mockStudentRepository },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: ImagesService, useValue: mockImagesService },
        { provide: BusService, useValue: mockBusService },
      ],
    }).compile();
 
    service = module.get<StudentService>(StudentService);
    jest.clearAllMocks();
  });
 
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
