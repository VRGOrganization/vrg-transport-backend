import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Employee, EmployeeDocument } from '../schema/employee.schema';
import { IEmployeeRepository } from '../interface/repository.interface';

@Injectable()
export class EmployeeRepository implements IEmployeeRepository<Employee> {
  constructor(
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  async create(data: Partial<Employee>): Promise<Employee> {
    const employee = new this.employeeModel(data);
    return employee.save();
  }

  async findAll(): Promise<Employee[]> {
    return this.employeeModel.find({ active: true }).exec();
  }

  async findAllInactive(): Promise<Employee[]> {
    return this.employeeModel.find({ active: false }).exec();
  }

  async findById(id: string): Promise<Employee | null> {
    return this.employeeModel.findById(id).exec();
  }

  async findByRegistrationId(registrationId: string): Promise<Employee | null> {
    return this.employeeModel
      .findOne({ registrationId: registrationId, active: true })
      .exec();
  }

  async findByRegistrationIdWithPassword(registrationId: string) {
    return this.employeeModel
      .findOne({ registrationId, active: true })
      .select('+password +refreshTokenHash +refreshTokenVersion')
      .exec();
  }

  async findByEmail(email: string): Promise<Employee | null> {
    return this.employeeModel.findOne({ email, active: true }).exec();
  }

  async update(id: string, data: Partial<Employee>): Promise<Employee | null> {
  return this.employeeModel
    .findByIdAndUpdate(id, { $set: data }, { new: true })
    .exec();
  }

  async deactivate(id: string): Promise<boolean> {
    const result = await this.employeeModel
      .findByIdAndUpdate(id, { $set: { active: false } }, { new: true })
      .exec();
    return !!result;
  }
}
