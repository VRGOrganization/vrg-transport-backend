import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeController } from './employee.controller';
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

describe('EmployeeController', () => {
  let controller: EmployeeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeController],
      providers: [
        EmployeeService,
        { provide: EMPLOYEE_REPOSITORY, useValue: mockEmployeeRepository },
      ],
    }).compile();

    controller = module.get<EmployeeController>(EmployeeController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});