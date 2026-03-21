import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Employee } from './schema/employee.schema';
import {
  EMPLOYEE_REPOSITORY,
} from './interface/repository.interface';
import type { IEmployeeRepository } from './interface/repository.interface';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';

@Injectable()
export class EmployeeService {
  private readonly SALT_ROUNDS = 12;

  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    private readonly employeeRepository: IEmployeeRepository<Employee>,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const [emailExists, registrationIdExists] = await Promise.all([
      this.employeeRepository.findByEmail(dto.email),
      this.employeeRepository.findByMatricula(dto.registrationId),
    ]);

    if (emailExists) {
      throw new ConflictException('Já existe um funcionário com este e-mail');
    }
    if (registrationIdExists) {
      throw new ConflictException(
        'Já existe um funcionário com esta matrícula',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    // Mapeia registrationId (DTO) → matricula (schema)
    return this.employeeRepository.create({
      name: dto.name,
      email: dto.email,
      matricula: dto.registrationId,
      password: hashedPassword,
    });
  }

  async findAll(): Promise<Employee[]> {
    return this.employeeRepository.findAll();
  }

  async findById(id: string): Promise<Employee | null> {
    return this.employeeRepository.findById(id);
  }

  async findByMatricula(matricula: string): Promise<Employee | null> {
    return this.employeeRepository.findByMatricula(matricula);
  }

  async findByMatriculaWithPassword(
    matricula: string,
  ): Promise<Employee | null> {
    return this.employeeRepository.findByMatriculaWithPassword(matricula);
  }

  async findOneOrFail(id: string): Promise<Employee> {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Funcionário ${id} não encontrado`);
    }
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    }

    const employee = await this.employeeRepository.update(id, dto);
    if (!employee) {
      throw new NotFoundException(`Funcionário ${id} não encontrado`);
    }
    return employee;
  }

  async deactivate(id: string): Promise<{ message: string }> {
    const result = await this.employeeRepository.deactivate(id);
    if (!result) {
      throw new NotFoundException(`Funcionário ${id} não encontrado`);
    }
    return { message: 'Funcionário desativado com sucesso' };
  }
}