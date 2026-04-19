import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { StudentRepository } from './repository/student.repository';
import { Student, StudentSchema } from './schemas/student.schema';
import { STUDENT_REPOSITORY } from './interfaces/repository.interface';
import { CommonModule } from '../common/common.module';
import { ImagesModule } from '../image/image.module';
import { LicenseRequestModule } from '../license-request/license-request.module';
import { BusModule } from '../bus/bus.module';

@Module({
  imports: [
    CommonModule,
    ImagesModule,
    forwardRef(() => LicenseRequestModule),
    forwardRef(() => BusModule),
    MongooseModule.forFeature([{ name: Student.name, schema: StudentSchema }]),
  ],
  controllers: [StudentController],
  providers: [
    StudentService,
    {
      provide: STUDENT_REPOSITORY,
      useClass: StudentRepository,
    },
  ],
  exports: [StudentService],
})
export class StudentModule {}