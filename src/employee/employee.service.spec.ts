import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from './employee.service';
import { EMPLOYEE_REPOSITORY } from './interface/repository.interface';

const mockEmployeeRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByMatricula: jest.fn(),
  findByMatriculaWithPassword: jest.fn(),
  findByEmail: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
};

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: EMPLOYEE_REPOSITORY, useValue: mockEmployeeRepository },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});