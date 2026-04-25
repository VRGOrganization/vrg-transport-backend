import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { EmployeeRepository } from './repository/employee.repository';
import { Employee, EmployeeSchema } from './schema/employee.schema';
import { EMPLOYEE_REPOSITORY } from './interface/repository.interface';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([{ name: Employee.name, schema: EmployeeSchema }]),
  ],
  controllers: [EmployeeController],
  providers: [
    EmployeeService,
    {
      provide: EMPLOYEE_REPOSITORY,
      useClass: EmployeeRepository,
    },
  ],
  exports: [EmployeeService],
})
export class EmployeeModule {}