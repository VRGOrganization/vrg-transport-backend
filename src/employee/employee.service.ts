import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Employee } from './schema/employee.schema';
import { EMPLOYEE_REPOSITORY } from './interface/repository.interface';
import type { IEmployeeRepository } from './interface/repository.interface';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { AuditLogService } from '../common/audit/audit-log.service';

@Injectable()
export class EmployeeService {
  private readonly SALT_ROUNDS = 12;

  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    private readonly employeeRepository: IEmployeeRepository<Employee>,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const [emailExists, registrationIdExists] = await Promise.all([
      this.employeeRepository.findByEmail(dto.email),
      this.employeeRepository.findByRegistrationId(dto.registrationId),
    ]);

    if (emailExists) {
      throw new ConflictException('Já existe um funcionário com este e-mail');
    }
    if (registrationIdExists) {
      throw new ConflictException('Já existe um funcionário com esta matrícula');
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    const created = await this.employeeRepository.create({
      name: dto.name,
      email: dto.email,
      registrationId: dto.registrationId,
      password: hashedPassword,
      refreshTokenHash: null,
      refreshTokenVersion: 0,
    });

    await this.auditLog.record({
      action: 'employee.create',
      outcome: 'success',
      target: {
        employeeId: (created as any)._id?.toString?.() ?? undefined,
        email: created.email,
      },
    });

    return created;
  }

  async findAll(): Promise<Employee[]> {
    return this.employeeRepository.findAll();
  }

  async findAllInactive(): Promise<Employee[]> {
    return this.employeeRepository.findAllInactive();
  }

  async findById(id: string): Promise<Employee | null> {
    return this.employeeRepository.findById(id);
  }

  async findByRegistrationId(registrationId: string): Promise<Employee | null> {
    return this.employeeRepository.findByRegistrationId(registrationId);
  }

  async findByRegistrationIdWithPassword(registrationId: string): Promise<Employee | null> {
    return this.employeeRepository.findByRegistrationIdWithPassword(registrationId);
  }

  async findOneOrFail(id: string): Promise<Employee> {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Funcionário ${id} não encontrado`);
    }
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const updatePayload = { ...dto };

    if (updatePayload.password) {
      updatePayload.password = await bcrypt.hash(updatePayload.password, this.SALT_ROUNDS);
    }

    const employee = await this.employeeRepository.update(id, updatePayload);
    if (!employee) {
      throw new NotFoundException(`Funcionário ${id} não encontrado`);
    }

    await this.auditLog.record({
      action: 'employee.update',
      outcome: 'success',
      target: { employeeId: id },
      metadata: { fields: Object.keys(updatePayload) },
    });

    return employee;
  }

  
  async updateRefreshToken(id: string, hash: string, version: number): Promise<void> {
    await this.employeeRepository.update(id, {
      refreshTokenHash: hash,
      refreshTokenVersion: version,
    } as Partial<Employee>);
  }

  
  async clearRefreshToken(id: string): Promise<void> {
    await this.employeeRepository.update(id, {
      refreshTokenHash: null,
      refreshTokenVersion: Date.now(),
    } as Partial<Employee>);
  }

  async deactivate(id: string): Promise<{ message: string }> {
    const result = await this.employeeRepository.deactivate(id);
    if (!result) {
      throw new NotFoundException(`Funcionário ${id} não encontrado`);
    }

    await this.auditLog.record({
      action: 'employee.deactivate',
      outcome: 'success',
      target: { employeeId: id },
    });

    return { message: 'Funcionário desativado com sucesso' };
  }
}