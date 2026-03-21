import { Test, TestingModule } from '@nestjs/testing';
import { StudentService } from './student.service';
import { STUDENT_REPOSITORY } from './interfaces/repository.interface';
 
const mockStudentRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findByEmailWithSensitiveFields: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};
 
describe('StudentService', () => {
  let service: StudentService;
 
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        { provide: STUDENT_REPOSITORY, useValue: mockStudentRepository },
      ],
    }).compile();
 
    service = module.get<StudentService>(StudentService);
    jest.clearAllMocks();
  });
 
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});